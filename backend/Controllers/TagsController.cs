using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/tags")]
[Produces("application/json")]
[Authorize]
public class TagsController : ControllerBase
{
    private readonly AppDbContext _db;
    public TagsController(AppDbContext db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    public record TagDto(Guid Id, string Name, int SessionCount);
    public record RenameRequest([Required][MaxLength(50)] string Name);

    // GET /api/v1/tags — this user's tags with session counts
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<TagDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        // Projected into an anonymous type first, then mapped to the record —
        // EF Core can't translate a correlated collection .Count directly
        // inside a record's positional constructor within Select().
        var raw = await _db.Tags
            .Where(t => t.UserId == UserId)
            .Select(t => new { t.Id, t.Name, Count = t.SessionTags.Count })
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

        return Ok(raw.Select(t => new TagDto(t.Id, t.Name, t.Count)));
    }

    // PATCH /api/v1/tags/{id} — rename. Tags are per-user (see Tag entity), so
    // this can never affect another user's identically-named tag.
    [HttpPatch("{id:guid}")]
    [ProducesResponseType(typeof(TagDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Rename(Guid id, [FromBody] RenameRequest request, CancellationToken ct)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId, ct);
        if (tag is null) return NotFound();

        var newName  = request.Name.Trim().ToLowerInvariant();
        var conflict = await _db.Tags.AnyAsync(t => t.UserId == UserId && t.Name == newName && t.Id != id, ct);
        if (conflict) return Conflict("A tag with that name already exists.");

        tag.Name = newName;
        await _db.SaveChangesAsync(ct);

        var count = await _db.FocusSessionTags.CountAsync(fst => fst.TagId == id, ct);
        return Ok(new TagDto(tag.Id, tag.Name, count));
    }

    // DELETE /api/v1/tags/{id} — removes from all of this user's sessions and
    // deletes the tag row (safe — it's exclusively theirs).
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId, ct);
        if (tag is null) return NotFound();

        var tagRows = await _db.FocusSessionTags.Where(fst => fst.TagId == id).ToListAsync(ct);
        _db.FocusSessionTags.RemoveRange(tagRows);
        _db.Tags.Remove(tag);

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}