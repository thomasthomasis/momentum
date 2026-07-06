using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Momentum.Api.Data;

/// <summary>
/// Used exclusively by EF Core CLI tools (dotnet ef migrations add, etc.).
/// The tools call this instead of bootstrapping the full ASP.NET Core pipeline,
/// which means they never hit the Jwt:Secret null-check in Program.cs.
/// This class is NOT registered in DI and has zero effect at runtime.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Port=5433;Database=momentum;Username=postgres;Password=postgres")
            .UseSnakeCaseNamingConvention()
            .Options;

        return new AppDbContext(options);
    }
}