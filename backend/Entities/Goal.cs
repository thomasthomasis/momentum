namespace Momentum.Api.Entities;

public class Goal
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Null = global goal (all projects).
    /// Set = goal scoped to a specific project.
    /// </summary>
    public Guid? ProjectId { get; set; }

    public string? Label { get; set; }
    public double TargetHoursPerWeek { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public ApplicationUser User { get; set; } = null!;
    public Project? Project { get; set; }
}