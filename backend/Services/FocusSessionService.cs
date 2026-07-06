using Microsoft.EntityFrameworkCore;
using Momentum.Api.DTOs;
using Momentum.Api.Entities;
using Momentum.Api.Repositories;

namespace Momentum.Api.Services;

public class FocusSessionService : IFocusSessionService
{
    private readonly IFocusSessionRepository _sessionRepo;
    private readonly IProjectRepository _projectRepo;

    public FocusSessionService(
        IFocusSessionRepository sessionRepo,
        IProjectRepository projectRepo)
    {
        _sessionRepo = sessionRepo;
        _projectRepo = projectRepo;
    }

    public async Task<PagedResult<FocusSessionDto>> GetPagedAsync(
        FocusSessionFilterParams filters, string userId, CancellationToken ct = default)
    {
        var (items, hasMore) = await _sessionRepo.GetPagedAsync(filters, userId, ct);
        var itemList = items.ToList();

        string? nextCursor = null;
        if (hasMore && itemList.Count > 0)
        {
            var last = itemList[^1];
            nextCursor = FocusSessionRepository.EncodeCursor(last.StartedAt, last.Id);
        }

        return new PagedResult<FocusSessionDto>(
            itemList.Select(MapToDto),
            nextCursor,
            itemList.Count,
            hasMore
        );
    }

    public async Task<FocusSessionDto> GetByIdAsync(Guid id, string userId, CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Session {id} not found.");

        // Return 404 (not 403) to avoid leaking that the resource exists
        if (session.UserId != userId)
            throw new KeyNotFoundException($"Session {id} not found.");

        return MapToDto(session);
    }

    public async Task<FocusSessionDto> CreateAsync(
        CreateFocusSessionRequest request, string userId, CancellationToken ct = default)
    {
        if (!await _projectRepo.ExistsAsync(request.ProjectId, userId, ct))
            throw new KeyNotFoundException($"Project {request.ProjectId} not found.");

        if (request.EndedAt.HasValue && request.EndedAt < request.StartedAt)
            throw new ValidationException("EndedAt cannot be before StartedAt.");

        var session = new FocusSession
        {
            UserId = userId,
            ProjectId = request.ProjectId,
            Title = request.Title,
            Notes = request.Notes,
            EnergyLevel = request.EnergyLevel,
            Shipped = request.Shipped,
            StartedAt = request.StartedAt,
            EndedAt = request.EndedAt
        };

        await _sessionRepo.AddAsync(session, request.Tags ?? [], ct);

        return await GetByIdAsync(session.Id, userId, ct);
    }

    public async Task<FocusSessionDto> UpdateAsync(
        Guid id, UpdateFocusSessionRequest request, string userId, CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Session {id} not found.");

        if (session.UserId != userId)
            throw new KeyNotFoundException($"Session {id} not found.");

        if (request.Title is not null) session.Title = request.Title;
        if (request.Notes is not null) session.Notes = request.Notes;
        if (request.EnergyLevel.HasValue) session.EnergyLevel = request.EnergyLevel.Value;
        if (request.Shipped.HasValue) session.Shipped = request.Shipped.Value;
        if (request.StartedAt.HasValue) session.StartedAt = request.StartedAt.Value;
        if (request.EndedAt.HasValue)
        {
            if (request.EndedAt < session.StartedAt)
                throw new ValidationException("EndedAt cannot be before StartedAt.");
            session.EndedAt = request.EndedAt;
        }

        await _sessionRepo.UpdateAsync(session, ct);
        return await GetByIdAsync(session.Id, userId, ct);
    }

    public async Task DeleteAsync(Guid id, string userId, CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Session {id} not found.");

        if (session.UserId != userId)
            throw new KeyNotFoundException($"Session {id} not found.");

        await _sessionRepo.DeleteAsync(session.Id, ct);
    }

    public async Task<FocusSessionDto> PauseAsync(Guid id, string userId, CancellationToken ct = default)
    {
        var session = await GetOwnedBasicAsync(id, userId, ct);
        if (session.EndedAt.HasValue)
            throw new ValidationException("Session has already ended.");

        if (!session.IsPaused)
        {
            session.IsPaused = true;
            session.PausedAt = DateTime.UtcNow;
            await SaveWithConcurrencyCheckAsync(session, ct);
        }
        return await GetByIdAsync(session.Id, userId, ct);
    }

    public async Task<FocusSessionDto> ResumeAsync(Guid id, string userId, CancellationToken ct = default)
    {
        var session = await GetOwnedBasicAsync(id, userId, ct);

        if (session.IsPaused)
        {
            FinishPause(session);
            await SaveWithConcurrencyCheckAsync(session, ct);
        }
        return await GetByIdAsync(session.Id, userId, ct);
    }

    public async Task<FocusSessionDto> EndAsync(
        Guid id, EndSessionRequest request, string userId, CancellationToken ct = default)
    {
        var session = await GetOwnedBasicAsync(id, userId, ct);

        if (session.IsPaused) FinishPause(session);
        if (!session.EndedAt.HasValue) session.EndedAt = DateTime.UtcNow;
        if (request.Shipped.HasValue) session.Shipped = request.Shipped.Value;
        if (request.EnergyLevel.HasValue) session.EnergyLevel = request.EnergyLevel.Value;

        await SaveWithConcurrencyCheckAsync(session, ct);
        return await GetByIdAsync(session.Id, userId, ct);
    }

    public async Task<SessionStatusDto> GetStatusAsync(Guid id, string userId, CancellationToken ct = default)
    {
        var session = await GetOwnedBasicAsync(id, userId, ct);
        return new SessionStatusDto(
            session.Id, session.IsPaused, session.PausedAt,
            session.TotalPausedSeconds, session.StartedAt, session.EndedAt);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>Wraps the pause/resume/end save with the Postgres `xmin`
    /// concurrency check (see AppDbContext) — if the tray agent and extension
    /// raced to pause/resume the same session, the loser gets a clear 409
    /// instead of silently overwriting the winner's change (lost update).</summary>
    private async Task SaveWithConcurrencyCheckAsync(FocusSession session, CancellationToken ct)
    {
        try
        {
            await _sessionRepo.UpdateAsync(session, ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException(
                "This session was just updated elsewhere (e.g. by another client). Please retry.");
        }
    }

    private async Task<FocusSession> GetOwnedBasicAsync(Guid id, string userId, CancellationToken ct)
    {
        var session = await _sessionRepo.GetBasicByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Session {id} not found.");

        if (session.UserId != userId)
            throw new KeyNotFoundException($"Session {id} not found.");

        return session;
    }

    /// <summary>Folds the current pause interval into TotalPausedSeconds and clears
    /// pause state. Called on resume, and on end if the session was still paused —
    /// so duration math never has to special-case an in-progress pause.</summary>
    private static void FinishPause(FocusSession session)
    {
        if (session.PausedAt.HasValue)
            session.TotalPausedSeconds += (int)(DateTime.UtcNow - session.PausedAt.Value).TotalSeconds;
        session.IsPaused = false;
        session.PausedAt = null;
    }

    public Task<StatsDto> GetStatsAsync(
        Guid? projectId, string userId, DateTime? from, DateTime? to, CancellationToken ct = default)
        => _sessionRepo.GetStatsAsync(projectId, userId, from, to, ct);

    private static FocusSessionDto MapToDto(FocusSession s)
    {
        double? durationHours = s.EndedAt.HasValue
            ? Math.Round(((s.EndedAt.Value - s.StartedAt).TotalSeconds - s.TotalPausedSeconds) / 3600.0, 2)
            : null;

        return new FocusSessionDto(
            s.Id,
            s.ProjectId,
            s.Project.Name,
            s.Project.Color,
            s.Title,
            s.Notes,
            s.EnergyLevel,
            s.Shipped,
            s.StartedAt,
            s.EndedAt,
            durationHours,
            s.SessionTags.Select(st => st.Tag.Name),
            s.CreatedAt,
            s.BrowsedSites?.Select(bs => new BrowsedSiteDto(
                bs.Domain,
                bs.TimeSpentSeconds,
                bs.VisitCount,
                Math.Round(bs.TimeSpentSeconds / 60.0, 1)
            )) ?? [],
            s.IsPaused,
            s.PausedAt,
            s.TotalPausedSeconds,
            s.AppUsages?.Select(au => new AppUsageDto(
                au.AppName,
                au.TimeSpentSeconds,
                au.SwitchCount,
                Math.Round(au.TimeSpentSeconds / 60.0, 1)
            )) ?? []
        );
    }
}