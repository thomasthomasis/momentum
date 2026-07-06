namespace Momentum.Api.DTOs;

public record StatsDto(
    double TotalHours,
    int TotalSessions,
    double AverageEnergy,
    int ShippedCount,
    IEnumerable<ProjectStatDto> ByProject
);

public record ProjectStatDto(
    Guid ProjectId,
    string ProjectName,
    string ProjectColor,
    double TotalHours,
    int SessionCount,
    double AverageEnergy
);

public record SiteStatDto(
    string Domain,
    int TimeSpentSeconds,
    int VisitCount,
    int SessionCount
);

public record AppStatDto(
    string AppName,
    int TimeSpentSeconds,
    int SwitchCount,
    int SessionCount
);

public record StreakDto(
    int CurrentStreak,
    int LongestStreak,
    string? LastActiveDate
);