using Momentum.Api.DTOs;

namespace Momentum.Api.Services;

public interface IProjectService
{
    Task<IEnumerable<ProjectDto>> GetAllAsync(string userId, CancellationToken ct = default);
    Task<ProjectDto> GetByIdAsync(Guid id, string userId, CancellationToken ct = default);
    Task<ProjectDto> CreateAsync(CreateProjectRequest request, string userId, CancellationToken ct = default);
    Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectRequest request, string userId, CancellationToken ct = default);
    Task DeleteAsync(Guid id, string userId, CancellationToken ct = default);
}