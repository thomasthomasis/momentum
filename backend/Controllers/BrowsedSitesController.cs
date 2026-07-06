using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using Momentum.Api.DTOs;
using Momentum.Api.Entities;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/sessions/{sessionId:guid}/sites")]
[Produces("application/json")]
[Authorize]
public class BrowsedSitesController : ControllerBase
{
    private readonly AppDbContext _db;

    public BrowsedSitesController(AppDbContext db) => _db = db;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // A real session can only realistically visit so many distinct domains —
    // this bounds the DB write (RemoveRange+AddRange) against a malicious or
    // buggy client sending an unbounded batch in one request.
    private const int MaxBatchSize = 500;

    // POST — replace all sites (idempotent, extension calls on stop)
    [HttpPost]
    public async Task<IActionResult> LogSites(
        Guid sessionId, [FromBody] LogBrowsedSitesRequest request, CancellationToken ct)
    {
        if (request.Sites.Count() > MaxBatchSize)
            return BadRequest(new { error = $"Too many sites in one request (max {MaxBatchSize})." });

        var session = await _db.FocusSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == UserId, ct);
        if (session is null) return NotFound();

        var existing = await _db.BrowsedSites
            .Where(b => b.FocusSessionId == sessionId).ToListAsync(ct);
        _db.BrowsedSites.RemoveRange(existing);

        var newSites = request.Sites.Select(s => new BrowsedSite
        {
            FocusSessionId   = sessionId,
            Domain           = s.Domain.ToLowerInvariant().Trim(),
            TimeSpentSeconds = s.TimeSpentSeconds,
            VisitCount       = s.VisitCount,
            RecordedAt       = DateTime.UtcNow,
        });
        await _db.BrowsedSites.AddRangeAsync(newSites, ct);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // GET — list sites for a session
    [HttpGet]
    public async Task<IActionResult> GetSites(Guid sessionId, CancellationToken ct)
    {
        var sessionExists = await _db.FocusSessions
            .AnyAsync(s => s.Id == sessionId && s.UserId == UserId, ct);
        if (!sessionExists) return NotFound();

        var sites = await _db.BrowsedSites
            .Where(b => b.FocusSessionId == sessionId)
            .OrderByDescending(b => b.TimeSpentSeconds)
            .AsNoTracking().ToListAsync(ct);

        return Ok(sites.Select(b => new BrowsedSiteDto(
            b.Domain, b.TimeSpentSeconds, b.VisitCount,
            Math.Round(b.TimeSpentSeconds / 60.0, 1))));
    }

    // DELETE /{domain} — remove a single domain
    [HttpDelete("{domain}")]
    public async Task<IActionResult> DeleteSite(Guid sessionId, string domain, CancellationToken ct)
    {
        var sessionExists = await _db.FocusSessions
            .AnyAsync(s => s.Id == sessionId && s.UserId == UserId, ct);
        if (!sessionExists) return NotFound();

        var site = await _db.BrowsedSites
            .FirstOrDefaultAsync(b => b.FocusSessionId == sessionId && b.Domain == domain, ct);
        if (site is null) return NotFound();

        _db.BrowsedSites.Remove(site);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}