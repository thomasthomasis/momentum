using System.ComponentModel.DataAnnotations;

namespace Momentum.Api.DTOs;

/// <summary>
/// A single app-usage entry sent from the desktop tray agent.
/// </summary>
public record AppUsageRecord(
    [Required][MaxLength(260)] string AppName,
    [Range(1, int.MaxValue)] int TimeSpentSeconds,
    [Range(1, int.MaxValue)] int SwitchCount
);

/// <summary>
/// The full payload the tray agent sends on its periodic flush.
/// Replaces all app-usage rows for the session (delete-and-replace — idempotent,
/// safe to retry), same pattern as LogBrowsedSitesRequest.
/// </summary>
public record LogAppUsageRequest(
    [Required] IEnumerable<AppUsageRecord> Apps
);

/// <summary>
/// What the API returns — the saved app-usage data for display in the UI.
/// </summary>
public record AppUsageDto(
    string AppName,
    int TimeSpentSeconds,
    int SwitchCount,
    double TimeSpentMinutes
);
