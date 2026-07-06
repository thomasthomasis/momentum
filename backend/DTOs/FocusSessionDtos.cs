using System.ComponentModel.DataAnnotations;

namespace Momentum.Api.DTOs;

public record FocusSessionDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string ProjectColor,
    string Title,
    string? Notes,
    int EnergyLevel,
    bool Shipped,
    DateTime StartedAt,
    DateTime? EndedAt,
    double? DurationHours,
    IEnumerable<string> Tags,
    DateTime CreatedAt,
    IEnumerable<BrowsedSiteDto>? BrowsedSites,   // ← added
    bool IsPaused,
    DateTime? PausedAt,
    int TotalPausedSeconds,
    IEnumerable<AppUsageDto>? AppUsages
);

/// <summary>
/// Lightweight payload for frequent polling (extension alarm, tray agent) —
/// avoids pulling tags/sites/apps on every status check.
/// </summary>
public record SessionStatusDto(
    Guid Id,
    bool IsPaused,
    DateTime? PausedAt,
    int TotalPausedSeconds,
    DateTime StartedAt,
    DateTime? EndedAt
);

public record EndSessionRequest(
    bool? Shipped,
    [Range(1, 5)] int? EnergyLevel
);

public record CreateFocusSessionRequest(
    [Required] Guid ProjectId,
    [Required][MaxLength(200)] string Title,
    string? Notes,
    [Range(1, 5)] int EnergyLevel,
    bool Shipped,
    DateTime StartedAt,
    DateTime? EndedAt,
    IEnumerable<string>? Tags
);

public record UpdateFocusSessionRequest(
    [MaxLength(200)] string? Title,
    string? Notes,
    [Range(1, 5)] int? EnergyLevel,
    bool? Shipped,
    DateTime? StartedAt,   // ← added
    DateTime? EndedAt
);

/// <summary>
/// Wraps a page of results with cursor-based pagination metadata.
/// NextCursor is null when there are no more pages.
/// </summary>
public record PagedResult<T>(
    IEnumerable<T> Data,
    string? NextCursor,
    int Count,
    bool HasMore
);

public record FocusSessionFilterParams(
    Guid? ProjectId,
    DateTime? From,
    DateTime? To,
    int? MinEnergy,
    bool? ShippedOnly,
    string? AfterCursor,
    int Limit = 20
);