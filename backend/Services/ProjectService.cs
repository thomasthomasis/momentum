using Momentum.Api.DTOs;
using Momentum.Api.Entities;
using Momentum.Api.Repositories;

namespace Momentum.Api.Services;

public class ProjectService : IProjectService
{
    private readonly IProjectRepository _repo;

    public ProjectService(IProjectRepository repo) => _repo = repo;

    public async Task<IEnumerable<ProjectDto>> GetAllAsync(string userId, CancellationToken ct = default)
    {
        var projects = await _repo.GetAllWithStatsAsync(userId, ct);
        return projects.Select(MapToDto);
    }

    public async Task<ProjectDto> GetByIdAsync(Guid id, string userId, CancellationToken ct = default)
    {
        var project = await _repo.GetByIdAsync(id, ct);
        // Return 404 (not 403) — don't reveal that the resource exists for another user
        if (project is null || project.UserId != userId)
            throw new KeyNotFoundException($"Project {id} not found.");
        return MapToDto(project);
    }

    public async Task<ProjectDto> CreateAsync(CreateProjectRequest request, string userId, CancellationToken ct = default)
    {
        if (await _repo.ExistsByNameAsync(request.Name, userId, ct: ct))
            throw new ConflictException($"A project named '{request.Name}' already exists.");

        var project = new Project
        {
            UserId      = userId,
            Name        = request.Name,
            Description = request.Description,
            Color       = string.IsNullOrEmpty(request.Color) ? "#6366f1" : request.Color
        };

        await _repo.AddAsync(project, ct);
        return MapToDto(project);
    }

    public async Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectRequest request, string userId, CancellationToken ct = default)
    {
        var project = await _repo.GetByIdAsync(id, ct);
        if (project is null || project.UserId != userId)
            throw new KeyNotFoundException($"Project {id} not found.");

        if (request.Name is not null)
        {
            if (await _repo.ExistsByNameAsync(request.Name, userId, excludeId: id, ct: ct))
                throw new ConflictException($"A project named '{request.Name}' already exists.");
            project.Name = request.Name;
        }

        if (request.Description is not null) project.Description = request.Description;
        if (request.Color is not null) project.Color = request.Color;

        if (request.Status is not null)
        {
            if (!Enum.TryParse<ProjectStatus>(request.Status, ignoreCase: true, out var status))
                throw new ValidationException($"Invalid status '{request.Status}'. Valid values: Active, Archived.");
            project.Status = status;
        }

        await _repo.UpdateAsync(project, ct);
        return MapToDto(project);
    }

    public async Task DeleteAsync(Guid id, string userId, CancellationToken ct = default)
    {
        if (!await _repo.ExistsAsync(id, userId, ct))
            throw new KeyNotFoundException($"Project {id} not found.");

        await _repo.DeleteAsync(id, ct);
    }

    private static ProjectDto MapToDto(Project p) => new(
        p.Id,
        p.Name,
        p.Description,
        p.Color,
        p.Status.ToString(),
        p.CreatedAt,
        p.UpdatedAt,
        p.Sessions.Count,
        Math.Round(
            p.Sessions
                .Where(s => s.EndedAt.HasValue)
                .Sum(s => (s.EndedAt!.Value - s.StartedAt).TotalHours),
            2)
    );
}