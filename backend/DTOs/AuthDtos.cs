using System.ComponentModel.DataAnnotations;

namespace Momentum.Api.DTOs;

public record RegisterRequest(
    [Required][EmailAddress] string Email,
    [Required][MinLength(3)] string DisplayName,
    [Required][MinLength(8)] string Password
);

public record LoginRequest(
    [Required][EmailAddress] string Email,
    [Required]               string Password
);

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    string UserId,
    string Email,
    string DisplayName
);

public record RefreshRequest(
    [Required] string RefreshToken
);