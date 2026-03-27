using PersonalFinanceTracker.Api.Domain.Enums;

namespace PersonalFinanceTracker.Api.Contracts;

public sealed record AuthResponse(string AccessToken, string RefreshToken, UserSummary User);
public sealed record UserSummary(Guid Id, string Email, string DisplayName);
public sealed record LoginRequest(string Email, string Password);
public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record GoogleLoginRequest(string Credential);
public sealed record LogoutRequest(string RefreshToken);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Token, string Password);
public sealed record UserProfileDto(string DisplayName, string Email, string? Headline, string? PhoneNumber, string? City, string? ProfileImageUrl);
public sealed record UserProfileUpdateRequest(string DisplayName, string? Headline, string? PhoneNumber, string? City, string? ProfileImageUrl);

public sealed record AccountDto(Guid Id, string Name, AccountType Type, decimal OpeningBalance, decimal CurrentBalance, string Color, string Icon, string? InstitutionName);
public sealed record AccountUpsertRequest(string Name, AccountType Type, decimal OpeningBalance, string Color, string Icon, string? InstitutionName);

public sealed record AccountInvitationRequest(string Email, SharedRole Role);
public sealed record AccountInvitationDto(Guid Id, Guid AccountId, string Email, SharedRole Role, string Status, DateTime ExpiresAt);
public sealed record AccountMemberDto(Guid UserId, string Email, string DisplayName, SharedRole Role, string Permissions);
public sealed record UpdateAccountMemberRequest(SharedRole Role);
public sealed record RequestEditAccessRequest(string Message);

public sealed record CategoryDto(Guid Id, string Name, CategoryType Type, string Color, string Icon, bool IsArchived);
public sealed record CategoryUpsertRequest(string Name, CategoryType Type, string Color, string Icon, bool IsArchived);

public sealed record TransactionDto(Guid Id, Guid AccountId, string AccountName, Guid? TransferAccountId, Guid? CategoryId, string? CategoryName, TransactionType Type, decimal Amount, DateTime TransactionDate, string Merchant, string Note, string PaymentMethod, IReadOnlyList<string> Tags);
public sealed record TransactionUpsertRequest(Guid AccountId, Guid? TransferAccountId, Guid? CategoryId, TransactionType Type, decimal Amount, DateTime TransactionDate, string Merchant, string Note, string PaymentMethod, List<string> Tags);
public sealed record QuickAddParseRequest(string Input);
public sealed record QuickAddParseResponse(TransactionType Type, decimal Amount, string? CategoryHint, string? AccountHint, string Merchant, DateTime TransactionDate, IReadOnlyList<string> Chips);

public sealed record BudgetDto(Guid Id, Guid CategoryId, string CategoryName, int Month, int Year, decimal Amount, decimal Spent, int HealthPercent, Guid? AccountId, string? AccountName, bool IsShared, bool CanEdit);
public sealed record BudgetUpsertRequest(Guid CategoryId, int Month, int Year, decimal Amount, int AlertThresholdPercent, Guid? AccountId);

public sealed record GoalParticipantDto(Guid UserId, string Email, string DisplayName, SharedRole Role);
public sealed record GoalDto(Guid Id, string Name, decimal TargetAmount, decimal CurrentAmount, DateTime? TargetDate, string Icon, string Color, GoalStatus Status, Guid? LinkedAccountId, string? LinkedAccountName, bool IsShared, string OwnerDisplayName, IReadOnlyList<GoalParticipantDto> Participants);
public sealed record GoalUpsertRequest(string Name, decimal TargetAmount, DateTime? TargetDate, Guid? LinkedAccountId, string Icon, string Color);
public sealed record GoalEntryRequest(Guid? AccountId, GoalEntryType Type, decimal Amount, string Note);

public sealed record RecurringItemDto(Guid Id, string Title, TransactionType Type, decimal Amount, DateTime NextRunDate, bool IsPaused, RecurringFrequency Frequency, Guid AccountId, string AccountName, Guid? CategoryId, string? CategoryName, DateTime StartDate, DateTime? EndDate, bool AutoCreateTransaction);
public sealed record RecurringUpsertRequest(string Title, TransactionType Type, decimal Amount, Guid AccountId, Guid? CategoryId, RecurringFrequency Frequency, DateTime StartDate, DateTime? EndDate, bool AutoCreateTransaction, bool IsPaused);

public sealed record DashboardResponse(decimal Income, decimal Expense, decimal Net, IReadOnlyList<BudgetDto> Budgets, IReadOnlyList<CategorySpendPoint> SpendingByCategory, IReadOnlyList<TrendPoint> IncomeExpenseTrend, IReadOnlyList<TransactionDto> RecentTransactions, IReadOnlyList<RecurringItemDto> UpcomingRecurring, IReadOnlyList<GoalDto> Goals, ForecastMonthResponse Forecast, HealthScoreResponse HealthScore, IReadOnlyList<InsightCardDto> Insights);
public sealed record CategorySpendPoint(string Category, decimal Amount);
public sealed record TrendPoint(string Label, decimal Income, decimal Expense, decimal Balance);
public sealed record ReportResponse(IReadOnlyList<TrendPoint> MonthlyTrend, IReadOnlyList<CategorySpendPoint> CategoryBreakdown, IReadOnlyList<TrendPoint> AccountBalanceTrend, IReadOnlyList<GoalProgressPoint> SavingsProgress, IReadOnlyList<TrendPoint> SavingsRateTrend);
public sealed record GoalProgressPoint(string Goal, decimal ProgressPercent, decimal CurrentAmount, decimal TargetAmount);
public sealed record ForecastMonthResponse(decimal ProjectedEndBalance, decimal SafeToSpend, string Confidence, IReadOnlyList<string> Warnings);
public sealed record ForecastDailyPoint(DateTime Date, decimal ProjectedBalance);
public sealed record HealthScoreResponse(int Score, IReadOnlyList<HealthScoreFactorDto> Factors, IReadOnlyList<string> Suggestions);
public sealed record HealthScoreFactorDto(string Name, int Score, string Description);
public sealed record InsightCardDto(string Title, string Message, string Tone);

public sealed record RuleConditionDto(string Field, RuleOperator Operator, string Value);
public sealed record RuleActionDto(RuleActionType Type, string Value);
public sealed record RuleDto(Guid Id, int Priority, bool IsActive, IReadOnlyList<RuleConditionDto> Conditions, IReadOnlyList<RuleActionDto> Actions);
public sealed record RuleUpsertRequest(int Priority, bool IsActive, List<RuleConditionDto> Conditions, List<RuleActionDto> Actions);

public sealed record NotificationDto(Guid Id, NotificationType Type, string Title, string Body, bool EmailSent, DateTime CreatedAt, DateTime? ReadAt);
public sealed record MarkNotificationReadRequest(bool Read);

public sealed record AppBrandingResponse(string AppName, string CurrencyCode, string Locale, string NotificationMode, string DeploymentTarget, string PdfExportStyle);



