using System.ComponentModel.DataAnnotations;

namespace Momentum.Api.DTOs;

/// <summary>
/// A single site entry sent from the Chrome extension.
/// </summary>
public record BrowsedSiteRecord(
    [Required][MaxLength(253)] string Domain,
    [Range(1, int.MaxValue)] int TimeSpentSeconds,
    [Range(1, int.MaxValue)] int VisitCount
);

/// <summary>
/// The full payload the extension sends when a session ends.
/// Contains all sites visited during the session in one batch.
/// </summary>
public record LogBrowsedSitesRequest(
    [Required] IEnumerable<BrowsedSiteRecord> Sites
);

/// <summary>
/// What the API returns — the saved site data for display in the UI.
/// </summary>
public record BrowsedSiteDto(
    string Domain,
    int TimeSpentSeconds,
    int VisitCount,
    double TimeSpentMinutes
);