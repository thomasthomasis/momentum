using Microsoft.EntityFrameworkCore;
using Momentum.Api.Data;
using Momentum.Api.Entities;

namespace Momentum.Api.Repositories;

public class ProjectRepository : IProjectRepository
{
    private readonly AppDbContext _db;

    public ProjectRepository(AppDbContext db) => _db = db;

    public async Task<Project?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.Projects
            .Include(p => p.Sessions)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IEnumerable<Project>> GetAllWithStatsAsync(string userId, CancellationToken ct = default)
        => await _db.Projects
            .Where(p => p.UserId == userId)
            .Include(p => p.Sessions)
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string name, string userId, Guid? excludeId = null, CancellationToken ct = default)
        => await _db.Projects.AnyAsync(
            p => p.UserId == userId &&
                 p.Name == name &&
                 (excludeId == null || p.Id != excludeId), ct);

    public async Task<Project> AddAsync(Project project, CancellationToken ct = default)
    {
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(ct);
        return project;
    }

    public async Task UpdateAsync(Project project, CancellationToken ct = default)
    {
        _db.Projects.Update(project);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var project = await _db.Projects.FindAsync([id], ct);
        if (project is not null)
        {
            _db.Projects.Remove(project);
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task<bool> ExistsAsync(Guid id, string userId, CancellationToken ct = default)
        => await _db.Projects.AnyAsync(p => p.Id == id && p.UserId == userId, ct);
}