using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using Momentum.Api.DTOs;
using Momentum.Api.Services;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/stats")]
[Produces("application/json")]
[Authorize]
public class StatsController : ControllerBase
{
    private readonly IFocusSessionService _service;
    private readonly AppDbContext _db;

    public StatsController(IFocusSessionService service, AppDbContext db)
    { _service = service; _db = db; }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetStats(
        [FromQuery] Guid? projectId, [FromQuery] DateTime? from,
        [FromQuery] DateTime? to, CancellationToken ct)
    {
        var stats = await _service.GetStatsAsync(projectId, UserId, from, to, ct);
        return Ok(stats);
    }

    [HttpGet("sites")]
    public async Task<IActionResult> GetTopSites(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        var query = _db.BrowsedSites.Include(b => b.FocusSession)
            .Where(b => b.FocusSession.UserId == UserId);

        if (from.HasValue) query = query.Where(b => b.FocusSession.StartedAt >= from.Value);
        if (to.HasValue)   query = query.Where(b => b.FocusSession.StartedAt <= to.Value);

        var raw = await query
            .Select(b => new { b.Domain, b.TimeSpentSeconds, b.VisitCount, b.FocusSessionId })
            .ToListAsync(ct);

        var sites = raw
            .GroupBy(b => b.Domain)
            .Select(g => new SiteStatDto(
                g.Key,
                g.Sum(b => b.TimeSpentSeconds),
                g.Sum(b => b.VisitCount),
                g.Select(b => b.FocusSessionId).Distinct().Count()
            ))
            .OrderByDescending(s => s.TimeSpentSeconds)
            .Take(Math.Clamp(limit, 1, 50))
            .ToList();

        return Ok(sites);
    }

    [HttpGet("apps")]
    public async Task<IActionResult> GetTopApps(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        var query = _db.AppUsages.Include(a => a.FocusSession)
            .Where(a => a.FocusSession.UserId == UserId);

        if (from.HasValue) query = query.Where(a => a.FocusSession.StartedAt >= from.Value);
        if (to.HasValue)   query = query.Where(a => a.FocusSession.StartedAt <= to.Value);

        var raw = await query
            .Select(a => new { a.AppName, a.TimeSpentSeconds, a.SwitchCount, a.FocusSessionId })
            .ToListAsync(ct);

        var apps = raw
            .GroupBy(a => a.AppName)
            .Select(g => new AppStatDto(
                g.Key,
                g.Sum(a => a.TimeSpentSeconds),
                g.Sum(a => a.SwitchCount),
                g.Select(a => a.FocusSessionId).Distinct().Count()
            ))
            .OrderByDescending(a => a.TimeSpentSeconds)
            .Take(Math.Clamp(limit, 1, 50))
            .ToList();

        return Ok(apps);
    }

    [HttpGet("streak")]
    public async Task<IActionResult> GetStreak(CancellationToken ct)
    {
        var activeDates = await _db.FocusSessions
            .Where(s => s.UserId == UserId && s.EndedAt.HasValue)
            .Select(s => s.StartedAt.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .ToListAsync(ct);

        if (activeDates.Count == 0) return Ok(new StreakDto(0, 0, null));

        var today      = DateTime.UtcNow.Date;
        var lastActive = activeDates[0];

        int currentStreak = 0;
        if ((today - lastActive).Days <= 1)
        {
            var expected = lastActive;
            foreach (var date in activeDates)
            {
                if (date == expected) { currentStreak++; expected = expected.AddDays(-1); }
                else break;
            }
        }

        int longestStreak = 0, run = 1;
        for (int i = 1; i < activeDates.Count; i++)
        {
            if ((activeDates[i - 1] - activeDates[i]).Days == 1) run++;
            else run = 1;
            if (run > longestStreak) longestStreak = run;
        }
        longestStreak = Math.Max(longestStreak, currentStreak > 0 ? currentStreak : 1);

        return Ok(new StreakDto(currentStreak, longestStreak, lastActive.ToString("yyyy-MM-dd")));
    }
}