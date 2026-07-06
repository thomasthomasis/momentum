using System.ComponentModel.DataAnnotations;

namespace Momentum.Api.DTOs;

public record ProjectDto(
    Guid Id,
    string Name,
    string? Description,
    string Color,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int SessionCount,
    double TotalHours
);

public record CreateProjectRequest(
    [Required][MaxLength(100)] string Name,
    string? Description,
    string Color = "#6366f1"
);

public record UpdateProjectRequest(
    [MaxLength(100)] string? Name,
    string? Description,
    string? Color,
    string? Status
);