using Momentum.Api.DTOs;
using Momentum.Api.Entities;

namespace Momentum.Api.Repositories;

public interface IFocusSessionRepository
{
    Task<FocusSession?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Fetches just the session row — no Project/Tags/Sites/Apps includes.
    /// Used for pause/resume/end/status where only the session's own columns matter,
    /// to keep the polling path (hit every 5-30s by tray agent + extension) cheap.</summary>
    Task<FocusSession?> GetBasicByIdAsync(Guid id, CancellationToken ct = default);

    Task<(IEnumerable<FocusSession> Items, bool HasMore)> GetPagedAsync(
        FocusSessionFilterParams filters,
        string userId,
        CancellationToken ct = default);

    Task<FocusSession> AddAsync(
        FocusSession session,
        IEnumerable<string> tagNames,
        CancellationToken ct = default);

    Task UpdateAsync(FocusSession session, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<StatsDto> GetStatsAsync(Guid? projectId, string userId, DateTime? from, DateTime? to, CancellationToken ct = default);
}