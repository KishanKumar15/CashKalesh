using System.Text.Json;
using Xunit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PersonalFinanceTracker.Api.Common;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Domain.Enums;
using PersonalFinanceTracker.Api.Persistence;
using PersonalFinanceTracker.Api.Services;

namespace PersonalFinanceTracker.Api.Tests;

public sealed class AuthServiceTests
{
    [Fact]
    public async Task RegisterAsync_CreatesUserPreferenceAndRefreshToken()
    {
        await using var dbContext = TestDbFactory.Create();
        var service = CreateAuthService(dbContext);

        var response = await service.RegisterAsync(new RegisterRequest("person@example.com", "StrongPass1", "Person"), CancellationToken.None);

        var user = await dbContext.Users.Include(x => x.Preference).SingleAsync(x => x.Email == "person@example.com");
        Assert.Equal(response.User.Id, user.Id);
        Assert.NotNull(user.Preference);
        Assert.Equal("INR", user.Preference!.CurrencyCode);
        Assert.True(await dbContext.RefreshTokens.AnyAsync(x => x.UserId == user.Id));
    }

    [Fact]
    public async Task GoogleLoginAsync_CreatesUserWhenCredentialIsValid()
    {
        await using var dbContext = TestDbFactory.Create();
        var validator = new StubGoogleTokenValidator(new GoogleUserProfile("google-subject", "google@example.com", "Google User", null));
        var service = CreateAuthService(dbContext, validator);

        var response = await service.GoogleLoginAsync(new GoogleLoginRequest("valid-token"), CancellationToken.None);

        Assert.NotNull(response);
        var user = await dbContext.Users.Include(x => x.Preference).SingleAsync(x => x.Email == "google@example.com");
        Assert.Equal("Google User", user.DisplayName);
        Assert.NotNull(user.Preference);
        Assert.True(await dbContext.RefreshTokens.AnyAsync(x => x.UserId == user.Id));
    }

    private static AuthService CreateAuthService(AppDbContext dbContext, IGoogleTokenValidator? googleTokenValidator = null)
        => new(
            dbContext,
            Options.Create(new JwtOptions { Issuer = "CashKalesh", Audience = "CashKalesh.Frontend", SigningKey = "test-signing-key-test-signing-key-test", AccessTokenMinutes = 30, RefreshTokenDays = 14 }),
            Options.Create(new AppBrandingOptions { AppName = "CashKalesh", DefaultCurrency = "INR", DefaultLocale = "en-IN" }),
            new FakeEmailService(),
            new FakeAuditService(),
            googleTokenValidator ?? new StubGoogleTokenValidator(null));
}

public sealed class SharedGoalAnalyticsTests
{
    [Fact]
    public async Task Dashboard_ForSharedViewer_IncludesSharedGoalAndTransactions()
    {
        await using var dbContext = TestDbFactory.Create();
        var owner = new User { Email = "owner@example.com", DisplayName = "Owner", PasswordHash = "hash" };
        var viewer = new User { Email = "viewer@example.com", DisplayName = "Viewer", PasswordHash = "hash" };
        var category = new Category { User = owner, Name = "Home", Type = CategoryType.Expense, Color = "#fff", Icon = "home" };
        var account = new Account { User = owner, Name = "Home Savings", Type = AccountType.Savings, OpeningBalance = 1000, CurrentBalance = 3500, Color = "#10B981", Icon = "home" };
        var member = new AccountMember { Account = account, User = viewer, InvitedByUserId = owner.Id, Role = SharedRole.Editor };
        var transaction = new Transaction { User = owner, Account = account, Category = category, Type = TransactionType.Expense, Amount = 500, Merchant = "Builder", Note = "Deposit", PaymentMethod = "Bank", TransactionDate = DateTime.UtcNow.AddDays(-2) };
        var recurring = new RecurringTransaction { User = owner, AccountId = account.Id, Title = "Home SIP", Type = TransactionType.Expense, Amount = 1000, Frequency = RecurringFrequency.Monthly, StartDate = DateTime.UtcNow.Date, NextRunDate = DateTime.UtcNow.Date.AddDays(2) };
        var goal = new Goal { User = owner, LinkedAccount = account, Name = "Buy Home", TargetAmount = 1000000, CurrentAmount = 350000, TargetDate = DateTime.UtcNow.AddMonths(18), Icon = "house", Color = "#0EA5E9" };

        dbContext.AddRange(owner, viewer, category, account, member, transaction, recurring, goal);
        await dbContext.SaveChangesAsync();

        var accessService = new AccountAccessService(dbContext);
        var analyticsService = new AnalyticsService(dbContext, accessService);

        var dashboard = await analyticsService.GetDashboardAsync(viewer.Id, CancellationToken.None);

        Assert.Contains(dashboard.Goals, x => x.Name == "Buy Home" && x.IsShared && x.LinkedAccountName == "Home Savings");
        Assert.Contains(dashboard.RecentTransactions, x => x.Merchant == "Builder");
        Assert.Contains(dashboard.UpcomingRecurring, x => x.Title == "Home SIP");
    }
}

internal static class TestDbFactory
{
    public static AppDbContext Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }
}

internal sealed class FakeEmailService : IEmailService
{
    public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken) => Task.CompletedTask;
}

internal sealed class FakeAuditService : IAuditService
{
    public Task LogAsync(Guid userId, string entityType, Guid entityId, string action, object? metadata, CancellationToken cancellationToken) => Task.CompletedTask;
}

internal sealed class StubGoogleTokenValidator(GoogleUserProfile? profile) : IGoogleTokenValidator
{
    public Task<GoogleUserProfile?> ValidateAsync(string credential, CancellationToken cancellationToken) => Task.FromResult(profile);
}




public sealed class ReportingAndRulesTests
{
    [Fact]
    public async Task Reports_FilteredByAccountAndType_ReturnOnlyMatchingTransactions()
    {
        await using var dbContext = TestDbFactory.Create();
        var user = new User { Email = "report@example.com", DisplayName = "Report User", PasswordHash = "hash" };
        var housing = new Category { User = user, Name = "Housing", Type = CategoryType.Expense, Color = "#fff", Icon = "home" };
        var salary = new Category { User = user, Name = "Salary", Type = CategoryType.Income, Color = "#0f0", Icon = "briefcase" };
        var homeAccount = new Account { User = user, Name = "Home Account", Type = AccountType.Bank, OpeningBalance = 0, CurrentBalance = 25000, Color = "#10B981", Icon = "bank" };
        var travelAccount = new Account { User = user, Name = "Travel Account", Type = AccountType.Bank, OpeningBalance = 0, CurrentBalance = 8000, Color = "#2563EB", Icon = "wallet" };

        dbContext.AddRange(
            user,
            housing,
            salary,
            homeAccount,
            travelAccount,
            new Transaction { User = user, Account = homeAccount, Category = housing, Type = TransactionType.Expense, Amount = 18000, Merchant = "Builder", Note = "Deposit", PaymentMethod = "Bank", TransactionDate = DateTime.UtcNow.AddDays(-5) },
            new Transaction { User = user, Account = homeAccount, Category = salary, Type = TransactionType.Income, Amount = 85000, Merchant = "Employer", Note = "Salary", PaymentMethod = "Bank", TransactionDate = DateTime.UtcNow.AddDays(-3) },
            new Transaction { User = user, Account = travelAccount, Category = housing, Type = TransactionType.Expense, Amount = 3000, Merchant = "Trip", Note = "Hotel", PaymentMethod = "Card", TransactionDate = DateTime.UtcNow.AddDays(-2) });
        await dbContext.SaveChangesAsync();

        var analyticsService = new AnalyticsService(dbContext, new AccountAccessService(dbContext));

        var report = await analyticsService.GetReportsAsync(user.Id, DateTime.UtcNow.AddMonths(-1), DateTime.UtcNow, homeAccount.Id, null, TransactionType.Expense, CancellationToken.None);

        Assert.Single(report.CategoryBreakdown);
        Assert.Equal("Housing", report.CategoryBreakdown[0].Category);
        Assert.Equal(18000, report.CategoryBreakdown[0].Amount);
        Assert.All(report.MonthlyTrend, point => Assert.True(point.Expense == 0 || point.Expense == 18000));
    }

    [Fact]
    public async Task Dashboard_ForSharedViewer_IncludesSharedBudget()
    {
        await using var dbContext = TestDbFactory.Create();
        var owner = new User { Email = "budget-owner@example.com", DisplayName = "Budget Owner", PasswordHash = "hash" };
        var viewer = new User { Email = "budget-viewer@example.com", DisplayName = "Budget Viewer", PasswordHash = "hash" };
        var category = new Category { User = owner, Name = "Groceries", Type = CategoryType.Expense, Color = "#fff", Icon = "basket" };
        var account = new Account { User = owner, Name = "Family Account", Type = AccountType.Bank, OpeningBalance = 5000, CurrentBalance = 6200, Color = "#10B981", Icon = "wallet" };
        var member = new AccountMember { Account = account, User = viewer, InvitedByUserId = owner.Id, Role = SharedRole.Viewer };
        var budget = new Budget { User = owner, Account = account, Category = category, Month = DateTime.UtcNow.Month, Year = DateTime.UtcNow.Year, Amount = 12000, AlertThresholdPercent = 80 };
        var transaction = new Transaction { User = owner, Account = account, Category = category, Type = TransactionType.Expense, Amount = 3200, Merchant = "Big Basket", Note = "Weekly grocery", PaymentMethod = "Card", TransactionDate = DateTime.UtcNow.AddDays(-1) };

        dbContext.AddRange(owner, viewer, category, account, member, budget, transaction);
        await dbContext.SaveChangesAsync();

        var analyticsService = new AnalyticsService(dbContext, new AccountAccessService(dbContext));
        var dashboard = await analyticsService.GetDashboardAsync(viewer.Id, CancellationToken.None);

        var sharedBudget = Assert.Single(dashboard.Budgets, item => item.AccountName == "Family Account");
        Assert.True(sharedBudget.IsShared);
        Assert.False(sharedBudget.CanEdit);
        Assert.Equal(3200, sharedBudget.Spent);
    }

    [Fact]
    public async Task RuleEngine_AppliesCategoryTagAndAlertActions()
    {
        await using var dbContext = TestDbFactory.Create();
        var user = new User { Email = "rules@example.com", DisplayName = "Rules User", PasswordHash = "hash" };
        var category = new Category { User = user, Name = "Subscriptions", Type = CategoryType.Expense, Color = "#fff", Icon = "tv" };
        var account = new Account { User = user, Name = "Main Account", Type = AccountType.Bank, OpeningBalance = 0, CurrentBalance = 10000, Color = "#2563EB", Icon = "bank" };
        var rule = new Rule
        {
            User = user,
            Priority = 1,
            IsActive = true,
            ConditionJson = JsonSerializer.Serialize(new[] { new RuleConditionDto("merchant", RuleOperator.Contains, "netflix") }),
            ActionJson = JsonSerializer.Serialize(new[]
            {
                new RuleActionDto(RuleActionType.SetCategory, category.Id.ToString()),
                new RuleActionDto(RuleActionType.AddTag, "subscription"),
                new RuleActionDto(RuleActionType.TriggerAlert, "Subscription detected")
            })
        };

        dbContext.AddRange(user, category, account, rule);
        await dbContext.SaveChangesAsync();

        var engine = new RuleEngineService(dbContext);
        var result = await engine.ApplyAsync(user.Id, new TransactionUpsertRequest(account.Id, null, null, TransactionType.Expense, 799, DateTime.UtcNow, "Netflix", "Monthly billing", "Card", []), CancellationToken.None);

        Assert.Equal(category.Id, result.categoryId);
        Assert.Contains("subscription", result.tags);
        Assert.Contains("Subscription detected", result.alerts);
    }
}


