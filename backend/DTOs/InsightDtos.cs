namespace Momentum.Api.DTOs;

public record HourStat(int Hour, int SessionCount, double TotalHours);
public record DayStat(string DayName, int DayOfWeek, int SessionCount, double TotalHours);
public record TagStat(string Tag, int Count);

public record InsightsDto(
    HourStat? PeakHour,
    DayStat? BestDay,
    double AvgSessionHours,
    IEnumerable<HourStat> HourBreakdown,
    IEnumerable<DayStat> DayBreakdown,
    IEnumerable<TagStat> TopTags,
    int SessionsAnalysed
);