using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using Momentum.Api.DTOs;
using Momentum.Api.Entities;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/goals")]
[Produces("application/json")]
[Authorize]
public class GoalsController : ControllerBase
{
    private readonly AppDbContext _db;
    public GoalsController(AppDbContext db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<GoalDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var goals = await _db.Goals
            .Include(g => g.Project)
            .Where(g => g.UserId == UserId)
            .OrderBy(g => g.CreatedAt)
            .AsNoTracking()
            .ToListAsync(ct);

        var today     = DateTime.UtcNow.Date;
        var dow       = (int)today.DayOfWeek;
        var weekStart = today.AddDays(dow == 0 ? -6 : -(dow - 1));
        var weekEnd   = weekStart.AddDays(7);

        var weekSessions = await _db.FocusSessions
            .Where(s => s.UserId == UserId
                     && s.EndedAt.HasValue
                     && s.StartedAt >= weekStart
                     && s.StartedAt < weekEnd)
            .Select(s => new { s.ProjectId, Hours = (s.EndedAt!.Value - s.StartedAt).TotalHours })
            .ToListAsync(ct);

        double totalWeekHours = weekSessions.Sum(s => s.Hours);

        var dtos = goals.Select(g =>
        {
            double actual = g.ProjectId.HasValue
                ? weekSessions.Where(s => s.ProjectId == g.ProjectId).Sum(s => s.Hours)
                : totalWeekHours;

            actual = Math.Round(actual, 2);
            double progress = Math.Min(100, Math.Round(actual / g.TargetHoursPerWeek * 100, 1));

            return new GoalDto(
                g.Id, g.ProjectId, g.Project?.Name, g.Project?.Color,
                g.Label, g.TargetHoursPerWeek, actual, progress, g.IsActive, g.CreatedAt
            );
        });

        return Ok(dtos);
    }

    [HttpPost]
    [ProducesResponseType(typeof(GoalDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateGoalRequest request, CancellationToken ct)
    {
        if (request.ProjectId.HasValue)
        {
            var exists = await _db.Projects
                .AnyAsync(p => p.Id == request.ProjectId && p.UserId == UserId, ct);
            if (!exists) return NotFound("Project not found.");
        }

        var goal = new Goal
        {
            UserId             = UserId,
            ProjectId          = request.ProjectId,
            Label              = request.Label,
            TargetHoursPerWeek = request.TargetHoursPerWeek,
            IsActive           = true,
        };

        _db.Goals.Add(goal);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetAll), await BuildDto(goal.Id, ct));
    }

    [HttpPatch("{id:guid}")]
    [ProducesResponseType(typeof(GoalDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateGoalRequest request, CancellationToken ct)
    {
        var goal = await _db.Goals
            .FirstOrDefaultAsync(g => g.Id == id && g.UserId == UserId, ct);
        if (goal is null) return NotFound();

        if (request.TargetHoursPerWeek.HasValue) goal.TargetHoursPerWeek = request.TargetHoursPerWeek.Value;
        if (request.Label is not null)            goal.Label              = request.Label;
        if (request.IsActive.HasValue)            goal.IsActive           = request.IsActive.Value;
        if (request.ProjectId.HasValue)           goal.ProjectId          = request.ProjectId;

        await _db.SaveChangesAsync(ct);
        return Ok(await BuildDto(goal.Id, ct));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var goal = await _db.Goals
            .FirstOrDefaultAsync(g => g.Id == id && g.UserId == UserId, ct);
        if (goal is null) return NotFound();

        _db.Goals.Remove(goal);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Builds a single goal's DTO directly, scoped only to the sessions
    /// relevant to it — avoids re-running GetAll's full aggregation (all goals +
    /// all of this week's sessions) just to return one row after create/update.</summary>
    private async Task<GoalDto> BuildDto(Guid goalId, CancellationToken ct)
    {
        var goal = await _db.Goals.Include(g => g.Project).FirstAsync(g => g.Id == goalId, ct);

        var today     = DateTime.UtcNow.Date;
        var dow       = (int)today.DayOfWeek;
        var weekStart = today.AddDays(dow == 0 ? -6 : -(dow - 1));
        var weekEnd   = weekStart.AddDays(7);

        var sessionsQuery = _db.FocusSessions
            .Where(s => s.UserId == UserId && s.EndedAt.HasValue
                     && s.StartedAt >= weekStart && s.StartedAt < weekEnd);

        if (goal.ProjectId.HasValue)
            sessionsQuery = sessionsQuery.Where(s => s.ProjectId == goal.ProjectId);

        var hours = await sessionsQuery
            .Select(s => (s.EndedAt!.Value - s.StartedAt).TotalHours)
            .ToListAsync(ct);

        var actual   = Math.Round(hours.Sum(), 2);
        var progress = Math.Min(100, Math.Round(actual / goal.TargetHoursPerWeek * 100, 1));

        return new GoalDto(
            goal.Id, goal.ProjectId, goal.Project?.Name, goal.Project?.Color,
            goal.Label, goal.TargetHoursPerWeek, actual, progress, goal.IsActive, goal.CreatedAt
        );
    }
}