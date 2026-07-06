namespace Momentum.Api.Entities;

/// <summary>
/// Persisted refresh tokens — one row per issued token.
/// On use, the token is revoked and a new one is issued (rotation).
/// All of a user's tokens can be revoked at once (logout all devices).
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;

    /// <summary>SHA-256 hash of the opaque token value sent to and from the
    /// client — the raw value itself is never persisted (see AuthController).</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Set when the token is consumed or invalidated.</summary>
    public DateTime? RevokedAt { get; set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked => RevokedAt.HasValue;
    public bool IsActive => !IsRevoked && !IsExpired;

    // Navigation
    public ApplicationUser User { get; set; } = null!;
}