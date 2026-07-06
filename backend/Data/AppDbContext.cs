using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Momentum.Api.Entities;

namespace Momentum.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Project>         Projects         => Set<Project>();
    public DbSet<FocusSession>    FocusSessions    => Set<FocusSession>();
    public DbSet<Tag>             Tags             => Set<Tag>();
    public DbSet<FocusSessionTag> FocusSessionTags => Set<FocusSessionTag>();
    public DbSet<BrowsedSite>     BrowsedSites     => Set<BrowsedSite>();
    public DbSet<AppUsage>        AppUsages        => Set<AppUsage>();
    public DbSet<RefreshToken>    RefreshTokens    => Set<RefreshToken>();
    public DbSet<Goal>            Goals            => Set<Goal>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder); // Identity tables first

        modelBuilder.Entity<Project>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Name).IsRequired().HasMaxLength(100);
            e.Property(p => p.Color).HasMaxLength(7);
            e.Property(p => p.Status).HasConversion<string>();
            e.HasOne(p => p.User).WithMany(u => u.Projects)
             .HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(p => p.Sessions).WithOne(s => s.Project)
             .HasForeignKey(s => s.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => p.UserId);
        });

        modelBuilder.Entity<FocusSession>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Title).IsRequired().HasMaxLength(200);
            e.HasOne(s => s.User).WithMany()
             .HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.UserId);
            e.HasIndex(s => s.ProjectId);
            e.HasIndex(s => s.StartedAt);

            // Postgres's built-in xmin system column as an optimistic-concurrency
            // token — guards against lost updates when the tray agent (idle
            // detection) and the extension (manual pause/resume) race on the
            // same session, which happens via separate detached-entity
            // read/mutate/save round trips with no other locking.
            //
            // Marked obsolete in favor of IsRowVersion(), but that produces the
            // exact same (incorrect) "add xmin as a new column" migration output
            // as this does — either way the generated migration must have its
            // xmin AddColumn/DropColumn manually stripped, since the column
            // already exists on every Postgres table. Using the purpose-built
            // API here rather than suppressing the same caveat with more code.
#pragma warning disable CS0618
            e.UseXminAsConcurrencyToken();
#pragma warning restore CS0618
        });

        modelBuilder.Entity<Tag>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Name).IsRequired().HasMaxLength(50);
            e.HasIndex(t => new { t.UserId, t.Name }).IsUnique();
        });

        modelBuilder.Entity<FocusSessionTag>(e =>
        {
            e.HasKey(fst => new { fst.FocusSessionId, fst.TagId });
            e.HasOne(fst => fst.FocusSession).WithMany(s => s.SessionTags)
             .HasForeignKey(fst => fst.FocusSessionId);
            e.HasOne(fst => fst.Tag).WithMany(t => t.SessionTags)
             .HasForeignKey(fst => fst.TagId);
        });

        modelBuilder.Entity<BrowsedSite>(e =>
        {
            e.HasKey(b => b.Id);
            e.HasOne(b => b.FocusSession).WithMany(s => s.BrowsedSites)
             .HasForeignKey(b => b.FocusSessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppUsage>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.AppName).IsRequired().HasMaxLength(260);
            e.HasOne(a => a.FocusSession).WithMany(s => s.AppUsages)
             .HasForeignKey(a => a.FocusSessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(a => a.FocusSessionId);
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.HasKey(r => r.Id);
            e.HasOne(r => r.User).WithMany(u => u.RefreshTokens)
             .HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(r => r.TokenHash).IsUnique();
        });

        modelBuilder.Entity<Goal>(e =>
        {
            e.HasKey(g => g.Id);
            e.HasOne(g => g.User).WithMany()
             .HasForeignKey(g => g.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(g => g.Project).WithMany()
             .HasForeignKey(g => g.ProjectId).IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull); // deleting project clears scope, not goal
            e.HasIndex(g => g.UserId);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<Project>())
        {
            if (entry.State == EntityState.Added)
            { entry.Entity.Id = entry.Entity.Id == Guid.Empty ? Guid.NewGuid() : entry.Entity.Id;
              entry.Entity.CreatedAt = now; entry.Entity.UpdatedAt = now; }
            else if (entry.State == EntityState.Modified)
              entry.Entity.UpdatedAt = now;
        }

        foreach (var entry in ChangeTracker.Entries<FocusSession>())
            if (entry.State == EntityState.Added)
            { entry.Entity.Id = entry.Entity.Id == Guid.Empty ? Guid.NewGuid() : entry.Entity.Id;
              entry.Entity.CreatedAt = now; }

        foreach (var entry in ChangeTracker.Entries<Tag>())
            if (entry.State == EntityState.Added)
                entry.Entity.Id = entry.Entity.Id == Guid.Empty ? Guid.NewGuid() : entry.Entity.Id;

        foreach (var entry in ChangeTracker.Entries<Goal>())
        {
            if (entry.State == EntityState.Added)
            { entry.Entity.Id = entry.Entity.Id == Guid.Empty ? Guid.NewGuid() : entry.Entity.Id;
              entry.Entity.CreatedAt = now; entry.Entity.UpdatedAt = now; }
            else if (entry.State == EntityState.Modified)
              entry.Entity.UpdatedAt = now;
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}