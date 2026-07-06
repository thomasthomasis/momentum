using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Momentum.Api.Entities;
using System.Security.Claims;

namespace Momentum.Api.Controllers;

public record UpdateProfileRequest(string DisplayName);
public record DeleteAccountRequest(string Password);

[Authorize]
[ApiController]
[Route("api/v1/users")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public UsersController(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    private string CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("No user ID claim in token.");

    // ── PATCH /api/v1/users/me ─────────────────────────────────────────────

    /// <summary>Update the authenticated user's display name.</summary>
    [HttpPatch("me")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var name = req.DisplayName?.Trim() ?? string.Empty;

        if (name.Length < 2)
            return BadRequest(new { error = "Display name must be at least 2 characters." });

        if (name.Length > 50)
            return BadRequest(new { error = "Display name must be 50 characters or fewer." });

        var user = await _userManager.FindByIdAsync(CurrentUserId);
        if (user is null) return NotFound();

        user.DisplayName = name;
        var result = await _userManager.UpdateAsync(user);

        if (!result.Succeeded)
            return BadRequest(new { error = result.Errors.First().Description });

        return Ok(new UserDto(user.Id, user.Email!, user.DisplayName));
    }

    // ── DELETE /api/v1/users/me ────────────────────────────────────────────

    /// <summary>
    /// Permanently delete the authenticated user's account and all associated data.
    /// Password confirmation is required.
    /// </summary>
    [HttpDelete("me")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountRequest req)
    {
        var user = await _userManager.FindByIdAsync(CurrentUserId);
        if (user is null) return NotFound();

        if (!await _userManager.CheckPasswordAsync(user, req.Password))
            return Unauthorized(new { error = "Incorrect password." });

        var result = await _userManager.DeleteAsync(user);

        if (!result.Succeeded)
            return BadRequest(new { error = result.Errors.First().Description });

        // All related data (projects, sessions, refresh tokens, goals) is
        // removed by ON DELETE CASCADE defined in AppDbContext.
        return NoContent();
    }
}