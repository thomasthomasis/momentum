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
        // Lets `dotnet ef` target a different database (e.g. a real RDS instance
        // for an initial migration run) without editing this file each time:
        //   MOMENTUM_MIGRATION_CONNECTION="Host=...;..." dotnet ef database update
        var connectionString = Environment.GetEnvironmentVariable("MOMENTUM_MIGRATION_CONNECTION")
            ?? "Host=localhost;Port=5433;Database=momentum;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new AppDbContext(options);
    }
}