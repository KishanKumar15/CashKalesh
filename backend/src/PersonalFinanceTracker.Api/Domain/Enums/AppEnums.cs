namespace PersonalFinanceTracker.Api.Domain.Enums;

public enum AccountType
{
    Bank,
    CreditCard,
    CashWallet,
    Savings
}

public enum CategoryType
{
    Expense,
    Income
}

public enum TransactionType
{
    Expense,
    Income,
    Transfer
}

public enum GoalEntryType
{
    Contribution,
    Withdrawal
}

public enum GoalStatus
{
    Active,
    Completed,
    Paused
}

public enum RecurringFrequency
{
    Daily,
    Weekly,
    Monthly,
    Yearly
}

public enum NotificationType
{
    BudgetWarning,
    BudgetExceeded,
    RecurringUpcoming,
    GoalReached,
    TransactionSaved,
    RuleTriggered,
    SharedInvitation,
    SharedEditRequest,
    PasswordReset,
    System
}

public enum SharedRole
{
    Owner,
    Editor,
    Viewer
}

public enum RuleOperator
{
    Equals,
    Contains,
    StartsWith,
    GreaterThan,
    LessThan,
    InList
}

public enum RuleActionType
{
    SetCategory,
    AddTag,
    SetAccount,
    TriggerAlert,
    FlagReview
}

public enum ThemePreference
{
    System,
    Light,
    Dark
}
