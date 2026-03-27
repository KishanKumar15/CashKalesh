using Microsoft.EntityFrameworkCore;
using PersonalFinanceTracker.Api.Common;
using PersonalFinanceTracker.Api.Domain.Entities;

namespace PersonalFinanceTracker.Api.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<AccountMember> AccountMembers => Set<AccountMember>();
    public DbSet<AccountInvitation> AccountInvitations => Set<AccountInvitation>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<GoalEntry> GoalEntries => Set<GoalEntry>();
    public DbSet<RecurringTransaction> RecurringTransactions => Set<RecurringTransaction>();
    public DbSet<Rule> Rules => Set<Rule>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<UserPreference> UserPreferences => Set<UserPreference>();

    public override int SaveChanges()
    {
        NormalizeDateTimes();
        return base.SaveChanges();
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        NormalizeDateTimes();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        NormalizeDateTimes();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        NormalizeDateTimes();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("public");

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.Email).HasMaxLength(200);
            entity.Property(x => x.DisplayName).HasMaxLength(120);
            entity.Property(x => x.Headline).HasMaxLength(160);
            entity.Property(x => x.PhoneNumber).HasMaxLength(40);
            entity.Property(x => x.City).HasMaxLength(80);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasIndex(x => x.TokenHash).IsUnique();
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.ToTable("password_reset_tokens");
            entity.HasIndex(x => x.TokenHash).IsUnique();
        });

        modelBuilder.Entity<Account>(entity =>
        {
            entity.ToTable("accounts");
            entity.Property(x => x.OpeningBalance).HasPrecision(18, 2);
            entity.Property(x => x.CurrentBalance).HasPrecision(18, 2);
        });

        modelBuilder.Entity<AccountMember>(entity =>
        {
            entity.ToTable("account_members");
            entity.HasIndex(x => new { x.AccountId, x.UserId }).IsUnique();
        });

        modelBuilder.Entity<AccountInvitation>(entity =>
        {
            entity.ToTable("account_invitations");
            entity.HasIndex(x => x.InviteToken).IsUnique();
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasIndex(x => new { x.UserId, x.Name, x.Type }).IsUnique();
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.ToTable("transactions");
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.UserId, x.TransactionDate });
        });

        modelBuilder.Entity<Budget>(entity =>
        {
            entity.ToTable("budgets");
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.UserId, x.CategoryId, x.Month, x.Year, x.AccountId }).IsUnique();
        });

        modelBuilder.Entity<Goal>(entity =>
        {
            entity.ToTable("goals");
            entity.Property(x => x.TargetAmount).HasPrecision(18, 2);
            entity.Property(x => x.CurrentAmount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<GoalEntry>(entity =>
        {
            entity.ToTable("goal_entries");
            entity.Property(x => x.Amount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<RecurringTransaction>(entity =>
        {
            entity.ToTable("recurring_transactions");
            entity.Property(x => x.Amount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Rule>(entity => entity.ToTable("rules"));
        modelBuilder.Entity<Notification>(entity => entity.ToTable("notifications"));
        modelBuilder.Entity<AuditLog>(entity => entity.ToTable("audit_logs"));

        modelBuilder.Entity<UserPreference>(entity =>
        {
            entity.ToTable("user_preferences");
            entity.HasIndex(x => x.UserId).IsUnique();
        });

        modelBuilder.Entity<Account>()
            .HasOne(x => x.User)
            .WithMany(x => x.Accounts)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<AccountInvitation>()
            .HasOne(x => x.Account)
            .WithMany(x => x.Invitations)
            .HasForeignKey(x => x.AccountId);

        modelBuilder.Entity<AccountMember>()
            .HasOne(x => x.Account)
            .WithMany(x => x.Members)
            .HasForeignKey(x => x.AccountId);

        modelBuilder.Entity<Category>()
            .HasOne(x => x.User)
            .WithMany(x => x.Categories)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<Transaction>()
            .HasOne(x => x.User)
            .WithMany(x => x.Transactions)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<Transaction>()
            .HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Budget>()
            .HasOne(x => x.User)
            .WithMany(x => x.Budgets)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<Budget>()
            .HasOne(x => x.Account)
            .WithMany()
            .HasForeignKey(x => x.AccountId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Goal>()
            .HasOne(x => x.User)
            .WithMany(x => x.Goals)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<GoalEntry>()
            .HasOne(x => x.Goal)
            .WithMany(x => x.Entries)
            .HasForeignKey(x => x.GoalId);

        modelBuilder.Entity<RecurringTransaction>()
            .HasOne(x => x.User)
            .WithMany(x => x.RecurringTransactions)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<RecurringTransaction>()
            .HasOne(x => x.Account)
            .WithMany()
            .HasForeignKey(x => x.AccountId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RecurringTransaction>()
            .HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RefreshToken>()
            .HasOne(x => x.User)
            .WithMany(x => x.RefreshTokens)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<PasswordResetToken>()
            .HasOne(x => x.User)
            .WithMany(x => x.PasswordResetTokens)
            .HasForeignKey(x => x.UserId);

        modelBuilder.Entity<UserPreference>()
            .HasOne(x => x.User)
            .WithOne(x => x.Preference)
            .HasForeignKey<UserPreference>(x => x.UserId);
    }

    private void NormalizeDateTimes()
    {
        foreach (var entry in ChangeTracker.Entries().Where(x => x.State is EntityState.Added or EntityState.Modified))
        {
            foreach (var property in entry.Properties)
            {
                if (property.Metadata.ClrType == typeof(DateTime) && property.CurrentValue is DateTime dateTime)
                {
                    property.CurrentValue = UtcDateTime.EnsureUtc(dateTime);
                }
                else if (property.Metadata.ClrType == typeof(DateTime?) && property.CurrentValue is DateTime nullableDateTime)
                {
                    property.CurrentValue = UtcDateTime.EnsureUtc(nullableDateTime);
                }
            }
        }
    }
}
