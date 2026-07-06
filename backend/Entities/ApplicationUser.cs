using Microsoft.AspNetCore.Identity;

namespace Momentum.Api.Entities;

/// <summary>
/// Extends the default Identity user with a display name.
/// The base class provides Id (string), Email, UserName, PasswordHash, etc.
/// </summary>
public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<FocusSession> FocusSessions { get; set; } = new List<FocusSession>();
}