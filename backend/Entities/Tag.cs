namespace Momentum.Api.Entities;

public class Tag
{
    public Guid Id { get; set; }

    /// <summary>Tags are per-user, not shared — two users can independently have
    /// a tag named "focus" without either being able to see or modify the
    /// other's. (Previously a single global row was shared by name across all
    /// users, which let any user renaming a tag silently rename it for every
    /// other user who happened to use the same word.)</summary>
    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public ICollection<FocusSessionTag> SessionTags { get; set; } = new List<FocusSessionTag>();
}

public class FocusSessionTag
{
    public Guid FocusSessionId { get; set; }
    public FocusSession FocusSession { get; set; } = null!;
    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = null!;

}