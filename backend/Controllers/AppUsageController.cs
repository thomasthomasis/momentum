using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using Momentum.Api.DTOs;
using Momentum.Api.Entities;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/sessions/{sessionId:guid}/apps")]
[Produces("application/json")]
[Authorize]
public class AppUsageController : ControllerBase
{
    private readonly AppDbContext _db;

    public AppUsageController(AppDbContext db) => _db = db;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // Bounds the DB write against a malicious or buggy client sending an
    // unbounded batch in one request — a real 30s flush cycle will only ever
    // have a handful of distinct apps.
    private const int MaxBatchSize = 500;

    // POST — replace all app-usage rows (idempotent, tray agent calls on each flush)
    [HttpPost]
    public async Task<IActionResult> LogApps(
        Guid sessionId, [FromBody] LogAppUsageRequest request, CancellationToken ct)
    {
        if (request.Apps.Count() > MaxBatchSize)
            return BadRequest(new { error = $"Too many apps in one request (max {MaxBatchSize})." });

        var session = await _db.FocusSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == UserId, ct);
        if (session is null) return NotFound();

        var existing = await _db.AppUsages
            .Where(a => a.FocusSessionId == sessionId).ToListAsync(ct);
        _db.AppUsages.RemoveRange(existing);

        var newApps = request.Apps.Select(a => new AppUsage
        {
            FocusSessionId   = sessionId,
            AppName          = a.AppName.Trim(),
            TimeSpentSeconds = a.TimeSpentSeconds,
            SwitchCount      = a.SwitchCount,
            RecordedAt       = DateTime.UtcNow,
        });
        await _db.AppUsages.AddRangeAsync(newApps, ct);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // GET — list app usage for a session
    [HttpGet]
    public async Task<IActionResult> GetApps(Guid sessionId, CancellationToken ct)
    {
        var sessionExists = await _db.FocusSessions
            .AnyAsync(s => s.Id == sessionId && s.UserId == UserId, ct);
        if (!sessionExists) return NotFound();

        var apps = await _db.AppUsages
            .Where(a => a.FocusSessionId == sessionId)
            .OrderByDescending(a => a.TimeSpentSeconds)
            .AsNoTracking().ToListAsync(ct);

        return Ok(apps.Select(a => new AppUsageDto(
            a.AppName, a.TimeSpentSeconds, a.SwitchCount,
            Math.Round(a.TimeSpentSeconds / 60.0, 1))));
    }

    // DELETE /{appName} — remove a single app's usage row
    [HttpDelete("{appName}")]
    public async Task<IActionResult> DeleteApp(Guid sessionId, string appName, CancellationToken ct)
    {
        var sessionExists = await _db.FocusSessions
            .AnyAsync(s => s.Id == sessionId && s.UserId == UserId, ct);
        if (!sessionExists) return NotFound();

        var app = await _db.AppUsages
            .FirstOrDefaultAsync(a => a.FocusSessionId == sessionId && a.AppName == appName, ct);
        if (app is null) return NotFound();

        _db.AppUsages.Remove(app);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
