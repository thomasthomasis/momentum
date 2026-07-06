using System.ComponentModel.DataAnnotations;

namespace Momentum.Api.DTOs;

public record CreateGoalRequest(
    Guid? ProjectId,
    [Required][Range(0.5, 168)] double TargetHoursPerWeek,
    [MaxLength(100)] string? Label
);

public record UpdateGoalRequest(
    Guid? ProjectId,
    [Range(0.5, 168)] double? TargetHoursPerWeek,
    [MaxLength(100)] string? Label,
    bool? IsActive
);

public record GoalDto(
    Guid Id,
    Guid? ProjectId,
    string? ProjectName,
    string? ProjectColor,
    string? Label,
    double TargetHoursPerWeek,
    double ActualHoursThisWeek,
    double ProgressPercent,
    bool IsActive,
    DateTime CreatedAt
);