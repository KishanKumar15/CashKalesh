using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Domain.Enums;
using PersonalFinanceTracker.Api.Persistence;

namespace PersonalFinanceTracker.Api.Common;

public interface IAppSeeder
{
    Task SeedAsync(CancellationToken cancellationToken);
}

public sealed class AppSeeder(AppDbContext dbContext, IAccountBalanceService accountBalanceService) : IAppSeeder
{
    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        if (await dbContext.Users.AnyAsync(cancellationToken)) return;

        var user = new User
        {
            Email = "demo@personalfinance.dev",
            DisplayName = "Demo User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Demo1234")
        };

        dbContext.Users.Add(user);
        dbContext.UserPreferences.Add(new UserPreference { User = user, CurrencyCode = "INR", Locale = "en-IN" });

        var accounts = new[]
        {
            new Account { User = user, Name = "Salary Account", Type = AccountType.Bank, OpeningBalance = 120000, CurrentBalance = 120000, Color = "#2563EB", Icon = "landmark", InstitutionName = "HDFC Bank" },
            new Account { User = user, Name = "Savings Vault", Type = AccountType.Savings, OpeningBalance = 80000, CurrentBalance = 80000, Color = "#10B981", Icon = "piggy-bank", InstitutionName = "ICICI Bank" },
            new Account { User = user, Name = "Travel Card", Type = AccountType.CreditCard, OpeningBalance = 0, CurrentBalance = 0, Color = "#F59E0B", Icon = "credit-card", InstitutionName = "Axis Bank" }
        };
        dbContext.Accounts.AddRange(accounts);

        var categories = new[]
        {
            new Category { User = user, Name = "Food", Type = CategoryType.Expense, Color = "#F97316", Icon = "utensils" },
            new Category { User = user, Name = "Rent", Type = CategoryType.Expense, Color = "#EF4444", Icon = "house" },
            new Category { User = user, Name = "Transport", Type = CategoryType.Expense, Color = "#8B5CF6", Icon = "car" },
            new Category { User = user, Name = "Entertainment", Type = CategoryType.Expense, Color = "#EC4899", Icon = "film" },
            new Category { User = user, Name = "Subscriptions", Type = CategoryType.Expense, Color = "#0EA5E9", Icon = "receipt" },
            new Category { User = user, Name = "Utilities", Type = CategoryType.Expense, Color = "#14B8A6", Icon = "bolt" },
            new Category { User = user, Name = "Salary", Type = CategoryType.Income, Color = "#22C55E", Icon = "briefcase" },
            new Category { User = user, Name = "Freelance", Type = CategoryType.Income, Color = "#06B6D4", Icon = "sparkles" }
        };
        dbContext.Categories.AddRange(categories);

        await dbContext.SaveChangesAsync(cancellationToken);

        var transactions = new List<Transaction>();
        var salaryAccount = accounts[0];
        var savingsAccount = accounts[1];
        var creditCard = accounts[2];
        var salaryCategory = categories.First(x => x.Name == "Salary");

        for (var i = 0; i < 90; i++)
        {
            var date = UtcDateTime.StartOfDayUtc(DateTime.UtcNow).AddDays(-i);
            if (date.Day == 1)
            {
                transactions.Add(new Transaction { UserId = user.Id, AccountId = salaryAccount.Id, CategoryId = salaryCategory.Id, Type = TransactionType.Income, Amount = 85000, TransactionDate = date, Merchant = "Employer Inc", Note = "Monthly salary", PaymentMethod = "Bank transfer", TagsJson = "[\"salary\"]" });
            }
            if (date.Day == 3)
            {
                transactions.Add(new Transaction { UserId = user.Id, AccountId = salaryAccount.Id, CategoryId = categories.First(x => x.Name == "Rent").Id, Type = TransactionType.Expense, Amount = 22000, TransactionDate = date, Merchant = "Sunrise Residency", Note = "Monthly rent", PaymentMethod = "UPI", TagsJson = "[\"fixed\",\"housing\"]" });
            }
            if (i % 7 == 0)
            {
                transactions.Add(new Transaction { UserId = user.Id, AccountId = salaryAccount.Id, CategoryId = categories.First(x => x.Name == "Food").Id, Type = TransactionType.Expense, Amount = 1250 + (i % 5) * 180, TransactionDate = date, Merchant = "Fresh Basket", Note = "Groceries", PaymentMethod = "Card", TagsJson = "[\"groceries\"]" });
            }
            if (i % 9 == 0)
            {
                transactions.Add(new Transaction { UserId = user.Id, AccountId = creditCard.Id, CategoryId = categories.First(x => x.Name == "Entertainment").Id, Type = TransactionType.Expense, Amount = 799, TransactionDate = date, Merchant = "Netflix", Note = "Streaming", PaymentMethod = "Credit Card", TagsJson = "[\"subscription\"]" });
            }
            if (i % 14 == 0)
            {
                transactions.Add(new Transaction { UserId = user.Id, AccountId = salaryAccount.Id, TransferAccountId = savingsAccount.Id, Type = TransactionType.Transfer, Amount = 6000, TransactionDate = date, Merchant = "Internal Transfer", Note = "Savings sweep", PaymentMethod = "Transfer", TagsJson = "[\"save\"]" });
            }
        }

        dbContext.Transactions.AddRange(transactions);

        var foodCategory = categories.First(x => x.Name == "Food");
        var rentCategory = categories.First(x => x.Name == "Rent");
        var subscriptionsCategory = categories.First(x => x.Name == "Subscriptions");
        dbContext.Budgets.AddRange(
            new Budget { User = user, CategoryId = foodCategory.Id, Month = DateTime.UtcNow.Month, Year = DateTime.UtcNow.Year, Amount = 15000, AlertThresholdPercent = 80 },
            new Budget { User = user, CategoryId = rentCategory.Id, Month = DateTime.UtcNow.Month, Year = DateTime.UtcNow.Year, Amount = 22000, AlertThresholdPercent = 100 },
            new Budget { User = user, CategoryId = subscriptionsCategory.Id, Month = DateTime.UtcNow.Month, Year = DateTime.UtcNow.Year, Amount = 3000, AlertThresholdPercent = 80 });

        var goal = new Goal { User = user, LinkedAccountId = savingsAccount.Id, Name = "Japan Trip", TargetAmount = 180000, CurrentAmount = 72000, TargetDate = UtcDateTime.StartOfDayUtc(DateTime.UtcNow).AddMonths(9), Icon = "plane", Color = "#0EA5E9" };
        dbContext.Goals.Add(goal);
        dbContext.GoalEntries.Add(new GoalEntry { Goal = goal, User = user, AccountId = savingsAccount.Id, Type = GoalEntryType.Contribution, Amount = 12000, Note = "Bonus allocation" });

        dbContext.RecurringTransactions.AddRange(
            new RecurringTransaction { User = user, Title = "Netflix", Type = TransactionType.Expense, Amount = 799, CategoryId = subscriptionsCategory.Id, AccountId = creditCard.Id, Frequency = RecurringFrequency.Monthly, StartDate = UtcDateTime.StartOfDayUtc(DateTime.UtcNow).AddMonths(-6), NextRunDate = UtcDateTime.StartOfDayUtc(DateTime.UtcNow).AddDays(5) },
            new RecurringTransaction { User = user, Title = "Internet", Type = TransactionType.Expense, Amount = 1299, CategoryId = categories.First(x => x.Name == "Utilities").Id, AccountId = salaryAccount.Id, Frequency = RecurringFrequency.Monthly, StartDate = UtcDateTime.StartOfDayUtc(DateTime.UtcNow).AddMonths(-4), NextRunDate = UtcDateTime.StartOfDayUtc(DateTime.UtcNow).AddDays(2) },
            new RecurringTransaction { User = user, Title = "Salary", Type = TransactionType.Income, Amount = 85000, CategoryId = salaryCategory.Id, AccountId = salaryAccount.Id, Frequency = RecurringFrequency.Monthly, StartDate = UtcDateTime.StartOfDayUtc(DateTime.UtcNow).AddMonths(-12), NextRunDate = UtcDateTime.StartOfMonthUtc(DateTime.UtcNow).AddMonths(1) });

        dbContext.Rules.Add(new Rule
        {
            User = user,
            Priority = 1,
            IsActive = true,
            ConditionJson = JsonSerializer.Serialize(new List<RuleConditionDto> { new("merchant", RuleOperator.Contains, "Uber") }),
            ActionJson = JsonSerializer.Serialize(new List<RuleActionDto> { new(RuleActionType.SetCategory, categories.First(x => x.Name == "Transport").Id.ToString()), new(RuleActionType.AddTag, "ride-share") })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await accountBalanceService.RecalculateAsync(user.Id, cancellationToken);
    }
}

public sealed class RecurringTransactionWorker(IServiceScopeFactory serviceScopeFactory, ILogger<RecurringTransactionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var balanceService = scope.ServiceProvider.GetRequiredService<IAccountBalanceService>();
                var dueItems = await dbContext.RecurringTransactions.Where(x => !x.IsPaused && x.AutoCreateTransaction && x.NextRunDate.Date <= DateTime.UtcNow.Date).ToListAsync(stoppingToken);

                foreach (var recurring in dueItems)
                {
                    var exists = await dbContext.Transactions.AnyAsync(x => x.RecurringTransactionId == recurring.Id && x.TransactionDate.Date == recurring.NextRunDate.Date, stoppingToken);
                    if (exists) continue;

                    dbContext.Transactions.Add(new Transaction
                    {
                        UserId = recurring.UserId,
                        AccountId = recurring.AccountId,
                        CategoryId = recurring.CategoryId,
                        RecurringTransactionId = recurring.Id,
                        Type = recurring.Type,
                        Amount = recurring.Amount,
                        TransactionDate = recurring.NextRunDate,
                        Merchant = recurring.Title,
                        Note = "Auto-generated recurring item",
                        PaymentMethod = "Recurring",
                        TagsJson = "[\"recurring\"]"
                    });

                    recurring.NextRunDate = recurring.Frequency switch
                    {
                        RecurringFrequency.Daily => recurring.NextRunDate.AddDays(1),
                        RecurringFrequency.Weekly => recurring.NextRunDate.AddDays(7),
                        RecurringFrequency.Monthly => recurring.NextRunDate.AddMonths(1),
                        RecurringFrequency.Yearly => recurring.NextRunDate.AddYears(1),
                        _ => recurring.NextRunDate.AddMonths(1)
                    };
                }

                if (dueItems.Count > 0)
                {
                    await dbContext.SaveChangesAsync(stoppingToken);
                    foreach (var userId in dueItems.Select(x => x.UserId).Distinct())
                    {
                        await balanceService.RecalculateAsync(userId, stoppingToken);
                    }
                }
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Recurring worker iteration failed.");
            }

            await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken);
        }
    }
}


