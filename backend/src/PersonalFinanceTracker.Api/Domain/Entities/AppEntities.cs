using PersonalFinanceTracker.Api.Domain.Enums;

namespace PersonalFinanceTracker.Api.Domain.Entities;

public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Headline { get; set; }
    public string? PhoneNumber { get; set; }
    public string? City { get; set; }
    public string? ProfileImageUrl { get; set; }
    public ICollection<Account> Accounts { get; set; } = new List<Account>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<Budget> Budgets { get; set; } = new List<Budget>();
    public ICollection<Goal> Goals { get; set; } = new List<Goal>();
    public ICollection<RecurringTransaction> RecurringTransactions { get; set; } = new List<RecurringTransaction>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
    public UserPreference? Preference { get; set; }
}

public sealed class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public sealed class PasswordResetToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

public sealed class Account : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public AccountType Type { get; set; }
    public decimal OpeningBalance { get; set; }
    public decimal CurrentBalance { get; set; }
    public string? InstitutionName { get; set; }
    public string Color { get; set; } = "#4F46E5";
    public string Icon { get; set; } = "wallet";
    public ICollection<AccountMember> Members { get; set; } = new List<AccountMember>();
    public ICollection<AccountInvitation> Invitations { get; set; } = new List<AccountInvitation>();
}

public sealed class AccountMember : BaseEntity
{
    public Guid AccountId { get; set; }
    public Account? Account { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid InvitedByUserId { get; set; }
    public SharedRole Role { get; set; }
}

public sealed class AccountInvitation : BaseEntity
{
    public Guid AccountId { get; set; }
    public Account? Account { get; set; }
    public string Email { get; set; } = string.Empty;
    public SharedRole Role { get; set; }
    public string InviteToken { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTime ExpiresAt { get; set; }
    public Guid InvitedByUserId { get; set; }
}

public sealed class Category : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public CategoryType Type { get; set; }
    public string Color { get; set; } = "#94A3B8";
    public string Icon { get; set; } = "tag";
    public bool IsArchived { get; set; }
}

public sealed class Transaction : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid AccountId { get; set; }
    public Account? Account { get; set; }
    public Guid? TransferAccountId { get; set; }
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }
    public Guid? RecurringTransactionId { get; set; }
    public TransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public DateTime TransactionDate { get; set; }
    public string Merchant { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string TagsJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class Budget : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }
    public Guid? AccountId { get; set; }
    public Account? Account { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal Amount { get; set; }
    public int AlertThresholdPercent { get; set; } = 80;
}

public sealed class Goal : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid? LinkedAccountId { get; set; }
    public Account? LinkedAccount { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal TargetAmount { get; set; }
    public decimal CurrentAmount { get; set; }
    public DateTime? TargetDate { get; set; }
    public string Icon { get; set; } = "target";
    public string Color { get; set; } = "#10B981";
    public GoalStatus Status { get; set; } = GoalStatus.Active;
    public ICollection<GoalEntry> Entries { get; set; } = new List<GoalEntry>();
}

public sealed class GoalEntry : BaseEntity
{
    public Guid GoalId { get; set; }
    public Goal? Goal { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid? AccountId { get; set; }
    public Account? Account { get; set; }
    public GoalEntryType Type { get; set; }
    public decimal Amount { get; set; }
    public string Note { get; set; } = string.Empty;
}

public sealed class RecurringTransaction : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Title { get; set; } = string.Empty;
    public TransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }
    public Guid AccountId { get; set; }
    public Account? Account { get; set; }
    public RecurringFrequency Frequency { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime NextRunDate { get; set; }
    public bool AutoCreateTransaction { get; set; } = true;
    public bool IsPaused { get; set; }
}

public sealed class Rule : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int Priority { get; set; }
    public string ConditionJson { get; set; } = "{}";
    public string ActionJson { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string MetadataJson { get; set; } = "{}";
    public DateTime? ReadAt { get; set; }
    public bool EmailSent { get; set; }
}

public sealed class AuditLog : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string MetadataJson { get; set; } = "{}";
}

public sealed class UserPreference : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string CurrencyCode { get; set; } = "INR";
    public string Locale { get; set; } = "en-IN";
    public string TimeZone { get; set; } = "Asia/Calcutta";
    public ThemePreference Theme { get; set; } = ThemePreference.System;
    public string StartOfWeek { get; set; } = "Monday";
}


