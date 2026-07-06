using Momentum.Api.Entities;

namespace Momentum.Api.Repositories;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IEnumerable<Project>> GetAllWithStatsAsync(string userId, CancellationToken ct = default);
    Task<bool> ExistsByNameAsync(string name, string userId, Guid? excludeId = null, CancellationToken ct = default);
    Task<Project> AddAsync(Project project, CancellationToken ct = default);
    Task UpdateAsync(Project project, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id, string userId, CancellationToken ct = default);
}