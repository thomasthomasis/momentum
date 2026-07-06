using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using Momentum.Api.DTOs;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/insights")]
[Produces("application/json")]
[Authorize]
public class InsightsController : ControllerBase
{
    private readonly AppDbContext _db;
    public InsightsController(AppDbContext db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    [ProducesResponseType(typeof(InsightsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInsights(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var sessionsQuery = _db.FocusSessions
            .Where(s => s.UserId == UserId && s.EndedAt.HasValue);

        if (from.HasValue) sessionsQuery = sessionsQuery.Where(s => s.StartedAt >= from.Value);
        if (to.HasValue)   sessionsQuery = sessionsQuery.Where(s => s.StartedAt <= to.Value);

        // Single DB fetch — aggregate in-process so we stay provider-portable
        var sessions = await sessionsQuery
            .Select(s => new {
                s.StartedAt, s.EndedAt,
                DurationHours = (s.EndedAt!.Value - s.StartedAt).TotalHours
            })
            .ToListAsync(ct);

        if (sessions.Count == 0)
            return Ok(new InsightsDto(null, null, 0,
                [], [], [], 0));

        // Hour breakdown — all 24 hours filled in (zeros for quiet hours)
        var hourGroups = sessions
            .GroupBy(s => s.StartedAt.Hour)
            .Select(g => new HourStat(g.Key, g.Count(), Math.Round(g.Sum(s => s.DurationHours), 2)))
            .ToDictionary(h => h.Hour);

        var hourBreakdown = Enumerable.Range(0, 24)
            .Select(h => hourGroups.TryGetValue(h, out var s) ? s : new HourStat(h, 0, 0))
            .ToList();

        var peakHour = hourBreakdown.MaxBy(h => h.SessionCount);

        // Day breakdown — Mon–Sun order
        var dayNames = new[] { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };
        var dayGroups = sessions
            .GroupBy(s => (int)s.StartedAt.DayOfWeek)
            .Select(g => new DayStat(dayNames[g.Key], g.Key, g.Count(),
                Math.Round(g.Sum(s => s.DurationHours), 2)))
            .ToDictionary(d => d.DayOfWeek);

        var dayBreakdown = new[] { 1, 2, 3, 4, 5, 6, 0 }
            .Select(d => dayGroups.TryGetValue(d, out var s) ? s : new DayStat(dayNames[d], d, 0, 0))
            .ToList();

        var bestDay = dayBreakdown.MaxBy(d => d.TotalHours);

        // Top tags
        var topTags = await _db.FocusSessionTags
            .Include(fst => fst.Tag)
            .Include(fst => fst.FocusSession)
            .Where(fst => fst.FocusSession.UserId == UserId && fst.FocusSession.EndedAt.HasValue)
            .GroupBy(fst => fst.Tag.Name)
            .Select(g => new TagStat(g.Key, g.Count()))
            .OrderByDescending(t => t.Count)
            .Take(8)
            .ToListAsync(ct);

        return Ok(new InsightsDto(
            peakHour?.SessionCount > 0 ? peakHour : null,
            bestDay?.TotalHours > 0 ? bestDay : null,
            Math.Round(sessions.Average(s => s.DurationHours), 2),
            hourBreakdown, dayBreakdown, topTags, sessions.Count
        ));
    }
}