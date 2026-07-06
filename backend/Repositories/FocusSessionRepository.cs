using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using Momentum.Api.DTOs;
using Momentum.Api.Entities;

namespace Momentum.Api.Repositories;

public class FocusSessionRepository : IFocusSessionRepository
{
    private readonly AppDbContext _db;

    public FocusSessionRepository(AppDbContext db) => _db = db;

    public async Task<FocusSession?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.FocusSessions
            .Include(s => s.Project)
            .Include(s => s.SessionTags).ThenInclude(st => st.Tag)
            .Include(s => s.BrowsedSites)
            .Include(s => s.AppUsages)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, ct);

    /// <summary>Deliberately tracked (not AsNoTracking) — pause/resume/end
    /// mutate and save the same entity within one request, and need EF to have
    /// captured the row's current `xmin` concurrency token from this read so
    /// the later SaveChanges can detect a concurrent modification.</summary>
    public async Task<FocusSession?> GetBasicByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.FocusSessions
            .FirstOrDefaultAsync(s => s.Id == id, ct);

    /// <summary>
    /// Cursor-based pagination over focus sessions.
    ///
    /// WHY cursor-based?
    ///   Offset pagination (SKIP n TAKE m) requires the DB to scan and discard n rows
    ///   before returning results — cost grows linearly with page depth.
    ///   A cursor encodes the position of the last seen row; the WHERE clause turns
    ///   it into an index seek, making every page O(log n + page_size).
    ///
    /// CURSOR ENCODING:
    ///   The cursor is base64(startedAt_ISO8601 | id).
    ///   We use (StartedAt DESC, Id DESC) ordering.
    ///   To get rows "after" the cursor we need rows where:
    ///     StartedAt < cursorDate  OR  (StartedAt == cursorDate AND Id < cursorId)
    ///   This handles ties in StartedAt without gaps or duplicates.
    ///
    /// FETCH LIMIT+1 TRICK:
    ///   We always ask for one extra row. If we get it, there IS a next page.
    ///   We then return only `limit` rows to the caller, not the extra.
    ///   This avoids a separate COUNT(*) query.
    /// </summary>
    public async Task<(IEnumerable<FocusSession> Items, bool HasMore)> GetPagedAsync(
        FocusSessionFilterParams filters,
        string userId,
        CancellationToken ct = default)
    {
        var query = _db.FocusSessions
            .Where(s => s.UserId == userId)
            .Include(s => s.Project)
            .Include(s => s.SessionTags).ThenInclude(st => st.Tag)
            .AsNoTracking()
            .AsQueryable();

        if (filters.ProjectId.HasValue)
            query = query.Where(s => s.ProjectId == filters.ProjectId);
        if (filters.From.HasValue)
            query = query.Where(s => s.StartedAt >= filters.From);
        if (filters.To.HasValue)
            query = query.Where(s => s.StartedAt <= filters.To);
        if (filters.MinEnergy.HasValue)
            query = query.Where(s => s.EnergyLevel >= filters.MinEnergy);
        if (filters.ShippedOnly == true)
            query = query.Where(s => s.Shipped);

        if (!string.IsNullOrEmpty(filters.AfterCursor))
        {
            var (cursorDate, cursorId) = DecodeCursor(filters.AfterCursor);
            query = query.Where(s =>
                s.StartedAt < cursorDate ||
                (s.StartedAt == cursorDate && string.Compare(s.Id.ToString(), cursorId.ToString()) < 0));
        }

        var limit = Math.Clamp(filters.Limit, 1, 100);
        var items = await query
            .OrderByDescending(s => s.StartedAt)
            .ThenByDescending(s => s.Id)
            .Take(limit + 1)
            .ToListAsync(ct);

        var hasMore = items.Count > limit;
        return (items.Take(limit), hasMore);
    }

    /// <summary>
    /// Creates a session and upserts its tags in one transaction.
    /// Tags are identified by (user, name) — case-insensitive, and always
    /// scoped to the session's own user so one user's rename/delete of a tag
    /// can never affect another user's identically-named tag.
    /// </summary>
    public async Task<FocusSession> AddAsync(
        FocusSession session,
        IEnumerable<string> tagNames,
        CancellationToken ct = default)
    {
        var normalizedNames = tagNames
            .Select(t => t.Trim().ToLowerInvariant())
            .Where(t => t.Length > 0)
            .Distinct()
            .ToList();

        foreach (var name in normalizedNames)
        {
            var tagId = await ResolveOrCreateTagIdAsync(session.UserId, name, ct);
            session.SessionTags.Add(new FocusSessionTag { FocusSession = session, TagId = tagId });
        }

        _db.FocusSessions.Add(session);
        await _db.SaveChangesAsync(ct);
        return session;
    }

    /// <summary>Atomically resolves a tag's id, creating it if it doesn't exist.
    /// Uses a single INSERT ... ON CONFLICT DO NOTHING round-trip rather than
    /// the previous check-then-insert pattern — two concurrent requests
    /// creating the same brand-new tag name used to race and throw an
    /// unhandled unique-constraint violation (a real 500, reproduced under
    /// parallel load) instead of both succeeding.</summary>
    private async Task<Guid> ResolveOrCreateTagIdAsync(string userId, string name, CancellationToken ct)
    {
        var newId = Guid.NewGuid();

        var inserted = await _db.Database.SqlQuery<Guid>(
            $"""
            INSERT INTO tags (id, user_id, name)
            VALUES ({newId}, {userId}, {name})
            ON CONFLICT (user_id, name) DO NOTHING
            RETURNING id
            """).ToListAsync(ct);

        if (inserted.Count > 0) return inserted[0];

        // Someone else won the race — their row is now committed, fetch its id.
        var existing = await _db.Database.SqlQuery<Guid>(
            $"SELECT id FROM tags WHERE user_id = {userId} AND name = {name}").ToListAsync(ct);
        return existing[0];
    }

    public async Task UpdateAsync(FocusSession session, CancellationToken ct = default)
    {
        _db.FocusSessions.Update(session);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var session = await _db.FocusSessions.FindAsync([id], ct);
        if (session is not null)
        {
            _db.FocusSessions.Remove(session);
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task<StatsDto> GetStatsAsync(
        Guid? projectId, string userId, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var query = _db.FocusSessions
            .Where(s => s.UserId == userId)
            .Include(s => s.Project)
            .AsNoTracking()
            .AsQueryable();

        if (projectId.HasValue) query = query.Where(s => s.ProjectId == projectId);
        if (from.HasValue) query = query.Where(s => s.StartedAt >= from);
        if (to.HasValue) query = query.Where(s => s.StartedAt <= to);

        var sessions = await query.ToListAsync(ct);

        if (!sessions.Any())
            return new StatsDto(0, 0, 0, 0, []);

        double TotalHours(IEnumerable<FocusSession> s) => s
            .Where(x => x.EndedAt.HasValue)
            .Sum(x => (x.EndedAt!.Value - x.StartedAt).TotalHours);

        var byProject = sessions
            .GroupBy(s => s.Project)
            .Select(g => new ProjectStatDto(
                g.Key.Id,
                g.Key.Name,
                g.Key.Color,
                Math.Round(TotalHours(g), 2),
                g.Count(),
                Math.Round(g.Average(s => s.EnergyLevel), 1)
            ))
            .OrderByDescending(p => p.TotalHours)
            .ToList();

        return new StatsDto(
            Math.Round(TotalHours(sessions), 2),
            sessions.Count,
            Math.Round(sessions.Average(s => s.EnergyLevel), 1),
            sessions.Count(s => s.Shipped),
            byProject
        );
    }

    // ── Cursor helpers ─────────────────────────────────────────────────────────

    public static string EncodeCursor(DateTime date, Guid id)
    {
        var raw = $"{date:O}|{id}";
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
    }

    private static (DateTime date, Guid id) DecodeCursor(string cursor)
    {
        var raw = Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
        var parts = raw.Split('|');
        return (
            DateTime.Parse(parts[0], null, DateTimeStyles.RoundtripKind),
            Guid.Parse(parts[1])
        );
    }
}