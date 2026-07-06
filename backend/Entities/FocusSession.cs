namespace Momentum.Api.Entities;

public class FocusSession
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public Guid ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }

    /// <summary>Self-rated energy level from 1 (drained) to 5 (peak focus).</summary>
    public int EnergyLevel { get; set; }

    /// <summary>Did you ship something meaningful in this session?</summary>
    public bool Shipped { get; set; }

    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>True while paused. Backend is the single source of truth — the
    /// tray app, extension, and web app all read/write this rather than tracking
    /// pause state locally.</summary>
    public bool IsPaused { get; set; }
    public DateTime? PausedAt { get; set; }

    /// <summary>Running total of paused time, accumulated each time the session
    /// resumes. Duration math subtracts this from (EndedAt ?? now) - StartedAt.</summary>
    public int TotalPausedSeconds { get; set; }

    // Navigation
    public ApplicationUser User { get; set; } = null!;
    public Project Project { get; set; } = null!;
    public ICollection<FocusSessionTag> SessionTags { get; set; } = new List<FocusSessionTag>();
    public ICollection<BrowsedSite>? BrowsedSites { get; set; }
    public ICollection<AppUsage>? AppUsages { get; set; }
}