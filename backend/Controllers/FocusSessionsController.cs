using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Momentum.Api.DTOs;
using Momentum.Api.Services;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

[ApiController]
[Route("api/v1/sessions")]
[Produces("application/json")]
[Authorize]
public class FocusSessionsController : ControllerBase
{
    private readonly IFocusSessionService _service;

    public FocusSessionsController(IFocusSessionService service) => _service = service;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<FocusSessionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? projectId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? minEnergy,
        [FromQuery] bool? shippedOnly,
        [FromQuery] string? afterCursor,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var filters = new FocusSessionFilterParams(
            projectId, from, to, minEnergy, shippedOnly, afterCursor,
            Math.Clamp(limit, 1, 100)
        );

        var result = await _service.GetPagedAsync(filters, UserId, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(FocusSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var session = await _service.GetByIdAsync(id, UserId, ct);
        return Ok(session);
    }

    [HttpPost]
    [ProducesResponseType(typeof(FocusSessionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create([FromBody] CreateFocusSessionRequest request, CancellationToken ct)
    {
        var session = await _service.CreateAsync(request, UserId, ct);
        return CreatedAtAction(nameof(GetById), new { id = session.Id }, session);
    }

    [HttpPatch("{id:guid}")]
    [ProducesResponseType(typeof(FocusSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateFocusSessionRequest request, CancellationToken ct)
    {
        var session = await _service.UpdateAsync(id, request, UserId, ct);
        return Ok(session);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, UserId, ct);
        return NoContent();
    }

    /// <summary>Pause a running session. Idempotent — pausing an already-paused
    /// session is a no-op. The tray agent is the primary caller (idle detection),
    /// but the extension and web app can call it too since the backend is the
    /// single source of truth for pause state.</summary>
    [HttpPost("{id:guid}/pause")]
    [ProducesResponseType(typeof(FocusSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct)
        => Ok(await _service.PauseAsync(id, UserId, ct));

    [HttpPost("{id:guid}/resume")]
    [ProducesResponseType(typeof(FocusSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct)
        => Ok(await _service.ResumeAsync(id, UserId, ct));

    [HttpPost("{id:guid}/end")]
    [ProducesResponseType(typeof(FocusSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> End(
        Guid id, [FromBody] EndSessionRequest? request, CancellationToken ct)
        => Ok(await _service.EndAsync(id, request ?? new EndSessionRequest(null, null), UserId, ct));

    /// <summary>Lightweight polling endpoint — just pause state and timestamps,
    /// no project/tags/sites/apps. Polled every 30s by the extension and by the
    /// web app on a shorter interval to reflect pause/resume events that
    /// originated elsewhere (e.g. the tray agent's idle detection).</summary>
    [HttpGet("{id:guid}/status")]
    [ProducesResponseType(typeof(SessionStatusDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStatus(Guid id, CancellationToken ct)
        => Ok(await _service.GetStatusAsync(id, UserId, ct));
}