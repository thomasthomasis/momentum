namespace Momentum.Api.Entities;

public class BrowsedSite
{
    public Guid Id { get; set; }
    public Guid FocusSessionId { get; set; }
    public string Domain { get; set; } = string.Empty;
    public int TimeSpentSeconds { get; set; }
    public int VisitCount { get; set; }
    public DateTime RecordedAt { get; set; }

    // Navigation
    public FocusSession FocusSession { get; set; } = null!;
}