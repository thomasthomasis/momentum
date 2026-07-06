namespace Momentum.Api.Entities;

public class AppUsage
{
    public Guid Id { get; set; }
    public Guid FocusSessionId { get; set; }
    public string AppName { get; set; } = string.Empty;
    public int TimeSpentSeconds { get; set; }
    public int SwitchCount { get; set; }
    public DateTime RecordedAt { get; set; }

    // Navigation
    public FocusSession FocusSession { get; set; } = null!;
}
