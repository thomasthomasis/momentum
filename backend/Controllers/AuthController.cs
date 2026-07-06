using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Momentum.Api.Data;
using Momentum.Api.Entities;
using Momentum.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Momentum.Api.Controllers;

public record RegisterRequest(string Email, string DisplayName, string Password);
public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);
public record AuthResponse(string AccessToken, string RefreshToken, int ExpiresIn, UserDto User);
public record UserDto(string Id, string Email, string DisplayName);
public record PairingCodeResponse(string Code, int ExpiresInSeconds);
public record PairRequest(string Code);

[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IPairingCodeStore _pairingCodes;

    private const int AccessTokenMinutes = 15;
    private const int RefreshTokenDays   = 30;
    private const int PairingCodeTtlSeconds = 300;

    // A precomputed, validly-formatted password hash with no corresponding real
    // account — verified against on every login attempt for an email that
    // doesn't exist, so that path takes roughly as long as a real password
    // check and doesn't leak account existence via response timing.
    private static readonly string DummyPasswordHash =
        new PasswordHasher<ApplicationUser>().HashPassword(null!, "timing-equalization-only");

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppDbContext db,
        IConfiguration config,
        IPairingCodeStore pairingCodes)
    {
        _userManager   = userManager;
        _signInManager = signInManager;
        _db            = db;
        _config        = config;
        _pairingCodes  = pairingCodes;
    }

    /// <summary>Create a new account and return tokens immediately.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        if (await _userManager.FindByEmailAsync(req.Email) is not null)
            return Conflict(new { error = "Email already in use." });

        var user = new ApplicationUser
        {
            UserName    = req.Email,
            Email       = req.Email,
            DisplayName = req.DisplayName,
            CreatedAt   = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, req.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description);
            return BadRequest(new { errors });
        }

        return Ok(await IssueTokensAsync(user, ct));
    }

    /// <summary>Authenticate with email + password, return tokens.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);

        if (user is null)
        {
            // Burn roughly the same CPU time as a real password check below,
            // so response timing can't reveal whether this email is registered.
            _userManager.PasswordHasher.VerifyHashedPassword(null!, DummyPasswordHash, req.Password);
            return Unauthorized(new { error = "Invalid email or password." });
        }

        // Goes through SignInManager (not UserManager.CheckPasswordAsync) so
        // failed attempts actually increment Identity's lockout counter.
        var result = await _signInManager.CheckPasswordSignInAsync(user, req.Password, lockoutOnFailure: true);

        if (result.IsLockedOut)
        {
            // CheckPasswordSignInAsync short-circuits on lockout *before* hashing,
            // so without this a locked-out account would respond measurably
            // faster than a wrong-password attempt — a smaller but real timing
            // signal on top of the one handled above.
            _userManager.PasswordHasher.VerifyHashedPassword(null!, DummyPasswordHash, req.Password);
            return Unauthorized(new { error = "Account temporarily locked due to repeated failed attempts. Try again later." });
        }

        if (!result.Succeeded)
            return Unauthorized(new { error = "Invalid email or password." });

        return Ok(await IssueTokensAsync(user, ct));
    }

    /// <summary>
    /// Exchange a valid refresh token for a new access token + rotated refresh token.
    /// The old refresh token is revoked immediately — replay attacks return 401.
    /// Presenting an *already-revoked* token (as opposed to merely expired or
    /// unknown) is treated as a theft signal: every active token for the user
    /// is revoked, forcing full re-authentication everywhere.
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
    {
        var tokenHash = HashToken(req.RefreshToken);
        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash, ct);

        if (stored is null)
            return Unauthorized(new { error = "Refresh token is invalid or expired." });

        if (stored.IsRevoked)
        {
            await RevokeAllTokensAsync(stored.UserId, ct);
            return Unauthorized(new { error = "Refresh token has already been used. All sessions have been signed out for safety." });
        }

        if (stored.IsExpired)
            return Unauthorized(new { error = "Refresh token is invalid or expired." });

        stored.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(await IssueTokensAsync(stored.User, ct));
    }

    /// <summary>Revoke the supplied refresh token (single device logout).</summary>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest req, CancellationToken ct)
    {
        var tokenHash = HashToken(req.RefreshToken);
        var stored = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash, ct);

        if (stored is { IsActive: true })
        {
            stored.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    /// <summary>Revoke every active refresh token for the signed-in user — "sign
    /// out everywhere," e.g. after a suspected compromise.</summary>
    [HttpPost("logout-all")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> LogoutAll(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        await RevokeAllTokensAsync(userId, ct);
        return NoContent();
    }

    /// <summary>
    /// Generates a short-lived, single-use pairing code for the signed-in user —
    /// used by the desktop tray agent's login flow so it doesn't need email/password
    /// typed into a native dialog (device-pairing pattern, like `docker login`).
    /// </summary>
    [HttpPost("pairing-code")]
    [Authorize]
    [ProducesResponseType(typeof(PairingCodeResponse), StatusCodes.Status200OK)]
    public IActionResult GeneratePairingCode()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var code = _pairingCodes.Generate(userId, TimeSpan.FromSeconds(PairingCodeTtlSeconds));
        return Ok(new PairingCodeResponse(code, PairingCodeTtlSeconds));
    }

    /// <summary>Exchanges a valid pairing code for tokens — the code is consumed
    /// (single-use) whether or not the subsequent lookup succeeds.</summary>
    [HttpPost("pair")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Pair([FromBody] PairRequest request, CancellationToken ct)
    {
        var userId = _pairingCodes.Consume(request.Code);
        var user = userId is not null ? await _userManager.FindByIdAsync(userId) : null;
        if (user is null)
            return Unauthorized(new { error = "Invalid or expired pairing code." });

        return Ok(await IssueTokensAsync(user, ct));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<AuthResponse> IssueTokensAsync(ApplicationUser user, CancellationToken ct)
    {
        var accessToken  = BuildAccessToken(user);
        var refreshToken = await CreateRefreshTokenAsync(user.Id, ct);

        return new AuthResponse(
            AccessToken:  accessToken,
            RefreshToken: refreshToken,
            ExpiresIn:    AccessTokenMinutes * 60,
            User:         new UserDto(user.Id, user.Email!, user.DisplayName)
        );
    }

    private string BuildAccessToken(ApplicationUser user)
    {
        var secret   = _config["Jwt:Secret"]!;
        var issuer   = _config["Jwt:Issuer"]   ?? "momentum-api";
        var audience = _config["Jwt:Audience"] ?? "momentum-app";
        var key      = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds    = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email,          user.Email!),
            new Claim("displayName",             user.DisplayName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer:             issuer,
            audience:           audience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>Generates a new refresh token and persists only its hash — the
    /// raw value (returned here) is never stored, so a database compromise
    /// alone can't be used to impersonate users via stolen refresh tokens.</summary>
    private async Task<string> CreateRefreshTokenAsync(string userId, CancellationToken ct)
    {
        // 32 random bytes → 64-char hex string (URL-safe, no padding issues)
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        var refreshToken = new RefreshToken
        {
            UserId    = userId,
            TokenHash = HashToken(rawToken),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays)
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync(ct);

        return rawToken;
    }

    /// <summary>SHA-256 is sufficient here (unlike password hashing) because the
    /// input is already a 256-bit cryptographically random value, not a
    /// low-entropy human-chosen secret — there's nothing for a slow KDF to
    /// protect against that a fast hash doesn't already prevent.</summary>
    private static string HashToken(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

    private async Task RevokeAllTokensAsync(string userId, CancellationToken ct)
    {
        var tokens = await _db.RefreshTokens
            .Where(r => r.UserId == userId && r.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var t in tokens) t.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}