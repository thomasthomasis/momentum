using Momentum.Api.DTOs;

namespace Momentum.Api.Services;

public interface IFocusSessionService
{
    Task<PagedResult<FocusSessionDto>> GetPagedAsync(FocusSessionFilterParams filters, string userId, CancellationToken ct = default);
    Task<FocusSessionDto> GetByIdAsync(Guid id, string userId, CancellationToken ct = default);
    Task<FocusSessionDto> CreateAsync(CreateFocusSessionRequest request, string userId, CancellationToken ct = default);
    Task<FocusSessionDto> UpdateAsync(Guid id, UpdateFocusSessionRequest request, string userId, CancellationToken ct = default);
    Task DeleteAsync(Guid id, string userId, CancellationToken ct = default);
    Task<FocusSessionDto> PauseAsync(Guid id, string userId, CancellationToken ct = default);
    Task<FocusSessionDto> ResumeAsync(Guid id, string userId, CancellationToken ct = default);
    Task<FocusSessionDto> EndAsync(Guid id, EndSessionRequest request, string userId, CancellationToken ct = default);
    Task<SessionStatusDto> GetStatusAsync(Guid id, string userId, CancellationToken ct = default);
    Task<StatsDto> GetStatsAsync(Guid? projectId, string userId, DateTime? from, DateTime? to, CancellationToken ct = default);
}