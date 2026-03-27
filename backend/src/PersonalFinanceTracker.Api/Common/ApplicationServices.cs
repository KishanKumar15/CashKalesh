using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Domain.Enums;
using PersonalFinanceTracker.Api.Persistence;
using PersonalFinanceTracker.Api.Services;

namespace PersonalFinanceTracker.Api.Common;

public interface IAccountBalanceService
{
    Task RecalculateAsync(Guid userId, CancellationToken cancellationToken);
}

public sealed class AccountBalanceService(AppDbContext dbContext) : IAccountBalanceService
{
    public async Task RecalculateAsync(Guid userId, CancellationToken cancellationToken)
    {
        var accounts = await dbContext.Accounts.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
        var transactions = await dbContext.Transactions.Where(x => x.UserId == userId).ToListAsync(cancellationToken);

        foreach (var account in accounts)
        {
            var balance = account.OpeningBalance;
            foreach (var transaction in transactions)
            {
                if (transaction.Type == TransactionType.Transfer)
                {
                    if (transaction.AccountId == account.Id) balance -= transaction.Amount;
                    if (transaction.TransferAccountId == account.Id) balance += transaction.Amount;
                    continue;
                }

                if (transaction.AccountId != account.Id) continue;
                balance += transaction.Type == TransactionType.Income ? transaction.Amount : -transaction.Amount;
            }

            account.CurrentBalance = balance;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

public interface IAnalyticsService
{
    Task<DashboardResponse> GetDashboardAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<BudgetDto>> GetBudgetsAsync(Guid userId, int month, int year, CancellationToken cancellationToken);
    Task<ReportResponse> GetReportsAsync(Guid userId, DateTime? from, DateTime? to, Guid? accountId, Guid? categoryId, TransactionType? type, CancellationToken cancellationToken);
    Task<ForecastMonthResponse> GetForecastMonthAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ForecastDailyPoint>> GetForecastDailyAsync(Guid userId, CancellationToken cancellationToken);
    Task<HealthScoreResponse> GetHealthScoreAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<InsightCardDto>> GetInsightsAsync(Guid userId, CancellationToken cancellationToken);
}

public sealed class AnalyticsService(AppDbContext dbContext, IAccountAccessService accessService) : IAnalyticsService
{
    public async Task<DashboardResponse> GetDashboardAsync(Guid userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var monthStart = UtcDateTime.StartOfMonthUtc(now);
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var monthTransactions = await BuildAccessibleTransactionsQuery(accessibleAccountIds)
            .Where(x => x.TransactionDate >= monthStart)
            .OrderByDescending(x => x.TransactionDate)
            .ToListAsync(cancellationToken);

        var income = monthTransactions.Where(x => x.Type == TransactionType.Income).Sum(x => x.Amount);
        var expense = monthTransactions.Where(x => x.Type == TransactionType.Expense).Sum(x => x.Amount);
        var budgets = await BuildBudgetDtosAsync(userId, now.Month, now.Year, cancellationToken);
        var spendingByCategory = monthTransactions.Where(x => x.Type == TransactionType.Expense && x.Category is not null)
            .GroupBy(x => x.Category!.Name)
            .Select(x => new CategorySpendPoint(x.Key, x.Sum(t => t.Amount)))
            .OrderByDescending(x => x.Amount)
            .Take(6)
            .ToList();

        var trendTransactions = await BuildAccessibleTransactionsQuery(accessibleAccountIds)
            .Where(x => x.TransactionDate >= monthStart.AddMonths(-5))
            .ToListAsync(cancellationToken);
        var incomeExpenseTrend = Enumerable.Range(0, 6).Select(offset =>
        {
            var date = monthStart.AddMonths(offset - 5);
            var items = trendTransactions.Where(x => x.TransactionDate.Year == date.Year && x.TransactionDate.Month == date.Month);
            var trendIncome = items.Where(x => x.Type == TransactionType.Income).Sum(x => x.Amount);
            var trendExpense = items.Where(x => x.Type == TransactionType.Expense).Sum(x => x.Amount);
            return new TrendPoint(date.ToString("MMM"), trendIncome, trendExpense, trendIncome - trendExpense);
        }).ToList();

        var recentTransactions = monthTransactions.Take(8).Select(MapTransaction).ToList();
        var recurring = await dbContext.RecurringTransactions
            .Include(x => x.Account)
            .Include(x => x.Category)
            .Where(x => accessibleAccountIds.Contains(x.AccountId) && !x.IsPaused)
            .OrderBy(x => x.NextRunDate)
            .Take(5)
            .ToListAsync(cancellationToken);
        var goals = await BuildGoalDtosAsync(userId, accessibleAccountIds, 4, cancellationToken);

        return new DashboardResponse(
            income,
            expense,
            income - expense,
            budgets,
            spendingByCategory,
            incomeExpenseTrend,
            recentTransactions,
            recurring.Select(MapRecurring).ToList(),
            goals,
            await GetForecastMonthAsync(userId, cancellationToken),
            await GetHealthScoreAsync(userId, cancellationToken),
            await GetInsightsAsync(userId, cancellationToken));
    }

    public async Task<IReadOnlyList<BudgetDto>> GetBudgetsAsync(Guid userId, int month, int year, CancellationToken cancellationToken)
        => await BuildBudgetDtosAsync(userId, month, year, cancellationToken);

    public async Task<ReportResponse> GetReportsAsync(Guid userId, DateTime? from, DateTime? to, Guid? accountId, Guid? categoryId, TransactionType? type, CancellationToken cancellationToken)
    {
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var scopedAccountIds = BuildScopedAccountIds(accessibleAccountIds, accountId);
        if (scopedAccountIds.Count == 0)
        {
            return BuildEmptyReport(from, to);
        }

        var rangeStart = NormalizeReportFrom(from);
        var rangeEndExclusive = NormalizeReportToExclusive(to, rangeStart);
        var query = BuildAccessibleTransactionsQuery(scopedAccountIds)
            .Where(x => x.TransactionDate >= rangeStart && x.TransactionDate < rangeEndExclusive);

        if (categoryId.HasValue)
        {
            query = query.Where(x => x.CategoryId == categoryId.Value);
        }

        if (type.HasValue)
        {
            query = query.Where(x => x.Type == type.Value);
        }

        var transactions = await query.ToListAsync(cancellationToken);
        var monthStart = UtcDateTime.StartOfMonthUtc(rangeStart);
        var finalMonth = UtcDateTime.StartOfMonthUtc(rangeEndExclusive.AddDays(-1));
        var monthCount = Math.Max(1, ((finalMonth.Year - monthStart.Year) * 12) + finalMonth.Month - monthStart.Month + 1);

        var monthlyTrend = Enumerable.Range(0, monthCount).Select(offset =>
        {
            var date = monthStart.AddMonths(offset);
            var items = transactions.Where(x => x.TransactionDate.Year == date.Year && x.TransactionDate.Month == date.Month);
            var trendIncome = items.Where(x => x.Type == TransactionType.Income).Sum(x => x.Amount);
            var trendExpense = items.Where(x => x.Type == TransactionType.Expense).Sum(x => x.Amount);
            return new TrendPoint(date.ToString("MMM yy"), trendIncome, trendExpense, trendIncome - trendExpense);
        }).ToList();

        var categoryBreakdown = transactions.Where(x => x.Type == TransactionType.Expense && x.Category is not null)
            .GroupBy(x => x.Category!.Name)
            .Select(x => new CategorySpendPoint(x.Key, x.Sum(t => t.Amount)))
            .OrderByDescending(x => x.Amount)
            .Take(10)
            .ToList();

        var accountBalanceTrend = transactions.Where(x => x.Account is not null)
            .GroupBy(x => x.Account!.Name)
            .Select(x => new TrendPoint(x.Key, 0, 0, x.Sum(t => t.Type == TransactionType.Income ? t.Amount : t.Type == TransactionType.Expense ? -t.Amount : 0m)))
            .OrderByDescending(x => x.Balance)
            .ToList();

        var savingsRateTrend = monthlyTrend.Select(item =>
        {
            var savingsRate = item.Income == 0 ? 0 : decimal.Round((item.Balance / item.Income) * 100m, 1);
            return new TrendPoint(item.Label, savingsRate, 0, savingsRate);
        }).ToList();

        var accessibleGoals = await BuildAccessibleGoalsQuery(userId, scopedAccountIds)
            .Where(x => !accountId.HasValue || !x.LinkedAccountId.HasValue || x.LinkedAccountId == accountId.Value)
            .ToListAsync(cancellationToken);
        var savingsProgress = accessibleGoals
            .Select(x => new GoalProgressPoint(x.Name, x.TargetAmount == 0 ? 0 : decimal.ToInt32(Math.Min(100, (x.CurrentAmount / x.TargetAmount) * 100m)), x.CurrentAmount, x.TargetAmount))
            .ToList();

        return new ReportResponse(monthlyTrend, categoryBreakdown, accountBalanceTrend, savingsProgress, savingsRateTrend);
    }

    public async Task<ForecastMonthResponse> GetForecastMonthAsync(Guid userId, CancellationToken cancellationToken)
    {
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var accounts = await dbContext.Accounts.Where(x => accessibleAccountIds.Contains(x.Id)).ToListAsync(cancellationToken);
        var recurring = await dbContext.RecurringTransactions.Where(x => accessibleAccountIds.Contains(x.AccountId) && !x.IsPaused && x.NextRunDate >= DateTime.UtcNow.Date).ToListAsync(cancellationToken);
        var transactions = await BuildAccessibleTransactionsQuery(accessibleAccountIds)
            .Where(x => x.TransactionDate >= DateTime.UtcNow.AddMonths(-3))
            .ToListAsync(cancellationToken);

        var currentBalance = accounts.Sum(x => x.CurrentBalance);
        var daysRemaining = DateTime.DaysInMonth(DateTime.UtcNow.Year, DateTime.UtcNow.Month) - DateTime.UtcNow.Day;
        var averageDailyExpense = transactions.Where(x => x.Type == TransactionType.Expense).Select(x => x.Amount).DefaultIfEmpty(0).Average();
        var averageDailyIncome = transactions.Where(x => x.Type == TransactionType.Income).Select(x => x.Amount).DefaultIfEmpty(0).Average();
        var projectedRecurringDelta = recurring.Sum(x => x.Type == TransactionType.Income ? x.Amount : -x.Amount);
        var projected = currentBalance + projectedRecurringDelta + (averageDailyIncome - averageDailyExpense) * daysRemaining;
        var safeToSpend = Math.Max(0, projected - currentBalance * 0.2m);

        var warnings = new List<string>();
        if (projected < 0) warnings.Add("Negative balance likely before month end.");
        if (safeToSpend < 5000) warnings.Add("Safe-to-spend buffer is tight this month.");
        if (recurring.Count == 0) warnings.Add("Forecast confidence is lower because there are no upcoming recurring items.");
        var confidence = transactions.Count < 8 ? "low" : transactions.Count < 30 ? "medium" : "high";
        return new ForecastMonthResponse(decimal.Round(projected, 2), decimal.Round(safeToSpend, 2), confidence, warnings);
    }

    public async Task<IReadOnlyList<ForecastDailyPoint>> GetForecastDailyAsync(Guid userId, CancellationToken cancellationToken)
    {
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var monthForecast = await GetForecastMonthAsync(userId, cancellationToken);
        var accountBalance = await dbContext.Accounts.Where(x => accessibleAccountIds.Contains(x.Id)).SumAsync(x => x.CurrentBalance, cancellationToken);
        var daysLeft = DateTime.DaysInMonth(DateTime.UtcNow.Year, DateTime.UtcNow.Month) - DateTime.UtcNow.Day + 1;
        var slope = daysLeft <= 1 ? 0 : (monthForecast.ProjectedEndBalance - accountBalance) / daysLeft;
        return Enumerable.Range(0, daysLeft).Select(day => new ForecastDailyPoint(DateTime.UtcNow.Date.AddDays(day), decimal.Round(accountBalance + slope * day, 2))).ToList();
    }

    public async Task<HealthScoreResponse> GetHealthScoreAsync(Guid userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var lastQuarter = await BuildAccessibleTransactionsQuery(accessibleAccountIds)
            .Where(x => x.TransactionDate >= now.AddMonths(-3))
            .ToListAsync(cancellationToken);
        var budgets = await BuildBudgetDtosAsync(userId, now.Month, now.Year, cancellationToken);
        var balances = await dbContext.Accounts.Where(x => accessibleAccountIds.Contains(x.Id)).SumAsync(x => x.CurrentBalance, cancellationToken);

        var income = lastQuarter.Where(x => x.Type == TransactionType.Income).Sum(x => x.Amount);
        var expense = lastQuarter.Where(x => x.Type == TransactionType.Expense).Sum(x => x.Amount);
        var savingsRate = income == 0 ? 40 : (int)Math.Clamp(((income - expense) / income) * 100m, 0, 100);
        var budgetAdherence = budgets.Count == 0 ? 60m : 100m - budgets.Average(x => (decimal)Math.Min(100, Math.Abs(100 - x.HealthPercent)));
        var cashBuffer = expense == 0 ? 80 : (int)Math.Clamp((balances / (expense / 3m)) * 25m, 0, 100);

        var monthlyExpenses = lastQuarter.Where(x => x.Type == TransactionType.Expense)
            .GroupBy(x => new { x.TransactionDate.Year, x.TransactionDate.Month })
            .Select(x => x.Sum(t => t.Amount))
            .ToList();

        var expenseStability = monthlyExpenses.Count < 2
            ? 65
            : (int)Math.Clamp(100 - (decimal)StandardDeviation(monthlyExpenses.Select(x => (double)x)) / Math.Max(1, monthlyExpenses.Average()) * 100m, 0, 100);

        var weightedScore = (int)Math.Round(savingsRate * 0.35m + budgetAdherence * 0.25m + cashBuffer * 0.20m + expenseStability * 0.20m);
        var factors = new List<HealthScoreFactorDto>
        {
            new("Savings rate", savingsRate, "Measures how much of your income stays unspent."),
            new("Budget adherence", (int)budgetAdherence, "Checks how closely your current month follows your budgets."),
            new("Cash buffer", cashBuffer, "Compares available cash with a month of spending."),
            new("Expense stability", expenseStability, "Rewards steadier spending patterns.")
        };

        var suggestions = new List<string>();
        if (savingsRate < 50) suggestions.Add("Reduce one flexible spending category to lift your savings rate.");
        if (cashBuffer < 50) suggestions.Add("Build a larger emergency cushion in your highest-liquidity account.");
        if (budgetAdherence < 60) suggestions.Add("Adjust budgets or tighten categories that routinely overshoot.");
        if (expenseStability < 60) suggestions.Add("Watch volatile categories and spread large purchases when possible.");
        if (suggestions.Count == 0) suggestions.Add("Your finances look balanced. Keep recurring reviews in place.");

        return new HealthScoreResponse(weightedScore, factors, suggestions);
    }

    public async Task<IReadOnlyList<InsightCardDto>> GetInsightsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var currentMonth = UtcDateTime.StartOfMonthUtc(DateTime.UtcNow);
        var previousMonth = currentMonth.AddMonths(-1);
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var transactions = await BuildAccessibleTransactionsQuery(accessibleAccountIds)
            .Where(x => x.TransactionDate >= previousMonth)
            .ToListAsync(cancellationToken);

        var currentExpense = transactions.Where(x => x.Type == TransactionType.Expense && x.TransactionDate >= currentMonth).Sum(x => x.Amount);
        var previousExpense = transactions.Where(x => x.Type == TransactionType.Expense && x.TransactionDate >= previousMonth && x.TransactionDate < currentMonth).Sum(x => x.Amount);
        var deltaPercent = previousExpense == 0 ? 0 : decimal.Round(((currentExpense - previousExpense) / previousExpense) * 100m, 1);

        var topCategory = transactions.Where(x => x.Type == TransactionType.Expense && x.TransactionDate >= currentMonth && x.Category is not null)
            .GroupBy(x => x.Category!.Name)
            .Select(x => new { Category = x.Key, Amount = x.Sum(t => t.Amount) })
            .OrderByDescending(x => x.Amount)
            .FirstOrDefault();

        return new List<InsightCardDto>
        {
            new("Monthly spend trend", $"Spending is {(deltaPercent >= 0 ? "up" : "down")} {Math.Abs(deltaPercent)}% versus last month.", deltaPercent > 0 ? "warning" : "positive"),
            new("Top category", topCategory is null ? "No clear category leader yet." : $"{topCategory.Category} is your largest spend category this month.", "neutral"),
            new("Forecast", $"Projected month-end balance stays around {(await GetForecastMonthAsync(userId, cancellationToken)).ProjectedEndBalance:n2}.", "positive")
        };
    }

    public static TransactionDto MapTransaction(Transaction transaction)
    {
        var tags = JsonSerializer.Deserialize<List<string>>(transaction.TagsJson) ?? [];
        return new TransactionDto(transaction.Id, transaction.AccountId, transaction.Account?.Name ?? string.Empty, transaction.TransferAccountId, transaction.CategoryId, transaction.Category?.Name, transaction.Type, transaction.Amount, transaction.TransactionDate, transaction.Merchant, transaction.Note, transaction.PaymentMethod, tags);
    }

    public static RecurringItemDto MapRecurring(RecurringTransaction recurring)
        => new(
            recurring.Id,
            recurring.Title,
            recurring.Type,
            recurring.Amount,
            recurring.NextRunDate,
            recurring.IsPaused,
            recurring.Frequency,
            recurring.AccountId,
            recurring.Account?.Name ?? string.Empty,
            recurring.CategoryId,
            recurring.Category?.Name,
            recurring.StartDate,
            recurring.EndDate,
            recurring.AutoCreateTransaction);

    public static GoalDto MapGoal(Goal goal)
    {
        var owner = goal.LinkedAccount?.User ?? goal.User;
        var participants = new List<GoalParticipantDto>();
        if (goal.LinkedAccount is not null)
        {
            if (goal.LinkedAccount.User is not null)
            {
                participants.Add(new GoalParticipantDto(goal.LinkedAccount.UserId, goal.LinkedAccount.User.Email, goal.LinkedAccount.User.DisplayName, SharedRole.Owner));
            }

            participants.AddRange(goal.LinkedAccount.Members
                .Where(x => x.User is not null)
                .Select(x => new GoalParticipantDto(x.UserId, x.User!.Email, x.User.DisplayName, x.Role)));
        }
        else if (goal.User is not null)
        {
            participants.Add(new GoalParticipantDto(goal.UserId, goal.User.Email, goal.User.DisplayName, SharedRole.Owner));
        }

        var dedupedParticipants = participants
            .GroupBy(x => x.UserId)
            .Select(x => x.First())
            .ToList();

        return new GoalDto(
            goal.Id,
            goal.Name,
            goal.TargetAmount,
            goal.CurrentAmount,
            goal.TargetDate,
            goal.Icon,
            goal.Color,
            goal.Status,
            goal.LinkedAccountId,
            goal.LinkedAccount?.Name,
            goal.LinkedAccountId.HasValue,
            owner?.DisplayName ?? goal.User?.DisplayName ?? "Goal owner",
            dedupedParticipants);
    }

    private static IReadOnlyCollection<Guid> BuildScopedAccountIds(IReadOnlyCollection<Guid> accessibleAccountIds, Guid? accountId)
    {
        if (!accountId.HasValue)
        {
            return accessibleAccountIds;
        }

        return accessibleAccountIds.Contains(accountId.Value)
            ? new[] { accountId.Value }
            : [];
    }

    private static DateTime NormalizeReportFrom(DateTime? from)
    {
        if (from.HasValue)
        {
            return UtcDateTime.StartOfDayUtc(from.Value);
        }

        var now = DateTime.UtcNow;
        return UtcDateTime.StartOfMonthUtc(now).AddMonths(-11);
    }

    private static DateTime NormalizeReportToExclusive(DateTime? to, DateTime rangeStart)
    {
        var inclusiveEnd = UtcDateTime.StartOfDayUtc(to ?? DateTime.UtcNow);
        if (inclusiveEnd < UtcDateTime.StartOfDayUtc(rangeStart))
        {
            inclusiveEnd = UtcDateTime.StartOfDayUtc(rangeStart);
        }

        return inclusiveEnd.AddDays(1);
    }

    private static ReportResponse BuildEmptyReport(DateTime? from, DateTime? to)
    {
        var rangeStart = NormalizeReportFrom(from);
        var rangeEndExclusive = NormalizeReportToExclusive(to, rangeStart);
        var monthStart = UtcDateTime.StartOfMonthUtc(rangeStart);
        var finalMonth = UtcDateTime.StartOfMonthUtc(rangeEndExclusive.AddDays(-1));
        var monthCount = Math.Max(1, ((finalMonth.Year - monthStart.Year) * 12) + finalMonth.Month - monthStart.Month + 1);
        var monthlyTrend = Enumerable.Range(0, monthCount)
            .Select(offset => monthStart.AddMonths(offset))
            .Select(date => new TrendPoint(date.ToString("MMM yy"), 0, 0, 0))
            .ToList();
        var savingsRateTrend = monthlyTrend.Select(item => new TrendPoint(item.Label, 0, 0, 0)).ToList();
        return new ReportResponse(monthlyTrend, [], [], [], savingsRateTrend);
    }

    private IQueryable<Transaction> BuildAccessibleTransactionsQuery(IReadOnlyCollection<Guid> accessibleAccountIds)
        => dbContext.Transactions
            .Include(x => x.Account)
            .Include(x => x.Category)
            .Where(x => accessibleAccountIds.Contains(x.AccountId) || (x.TransferAccountId.HasValue && accessibleAccountIds.Contains(x.TransferAccountId.Value)));

    private IQueryable<Goal> BuildAccessibleGoalsQuery(Guid userId, IReadOnlyCollection<Guid> accessibleAccountIds)
        => dbContext.Goals
            .Include(x => x.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.Members)
                    .ThenInclude(x => x.User)
            .Where(x => x.UserId == userId || (x.LinkedAccountId.HasValue && accessibleAccountIds.Contains(x.LinkedAccountId.Value)));

    private async Task<List<GoalDto>> BuildGoalDtosAsync(Guid userId, IReadOnlyCollection<Guid> accessibleAccountIds, int? take, CancellationToken cancellationToken)
    {
        var query = BuildAccessibleGoalsQuery(userId, accessibleAccountIds)
            .OrderBy(x => x.TargetDate ?? DateTime.MaxValue)
            .AsQueryable();

        if (take.HasValue)
        {
            query = query.Take(take.Value);
        }

        var goals = await query.ToListAsync(cancellationToken);
        return goals.Select(MapGoal).ToList();
    }

    private async Task<List<BudgetDto>> BuildBudgetDtosAsync(Guid userId, int month, int year, CancellationToken cancellationToken)
    {
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var ownedAccountIds = await dbContext.Accounts.Where(x => x.UserId == userId).Select(x => x.Id).ToListAsync(cancellationToken);
        var editableAccountIds = await dbContext.AccountMembers
            .Where(x => x.UserId == userId && x.Role != SharedRole.Viewer)
            .Select(x => x.AccountId)
            .ToListAsync(cancellationToken);
        editableAccountIds.AddRange(ownedAccountIds);
        var editableAccountSet = editableAccountIds.Distinct().ToHashSet();

        var budgets = await dbContext.Budgets
            .Include(x => x.Category)
            .Include(x => x.Account)
            .Where(x => x.Month == month && x.Year == year && (x.UserId == userId || (x.AccountId.HasValue && accessibleAccountIds.Contains(x.AccountId.Value))))
            .ToListAsync(cancellationToken);
        var start = UtcDateTime.CreateUtcDate(year, month, 1);
        var end = start.AddMonths(1);
        var transactions = await BuildAccessibleTransactionsQuery(accessibleAccountIds)
            .Where(x => x.TransactionDate >= start && x.TransactionDate < end)
            .ToListAsync(cancellationToken);
        var ownedAccountSet = ownedAccountIds.ToHashSet();

        return budgets.Select(x =>
        {
            var spent = x.AccountId.HasValue
                ? transactions.Where(t => t.AccountId == x.AccountId.Value && t.CategoryId == x.CategoryId && t.Type == TransactionType.Expense).Sum(t => t.Amount)
                : transactions.Where(t => ownedAccountSet.Contains(t.AccountId) && t.CategoryId == x.CategoryId && t.Type == TransactionType.Expense).Sum(t => t.Amount);
            var percent = x.Amount == 0 ? 0 : decimal.ToInt32(Math.Min(120, (spent / x.Amount) * 100m));
            var canEdit = x.AccountId.HasValue ? editableAccountSet.Contains(x.AccountId.Value) : x.UserId == userId;
            return new BudgetDto(x.Id, x.CategoryId, x.Category?.Name ?? "Unknown", x.Month, x.Year, x.Amount, spent, percent, x.AccountId, x.Account?.Name, x.AccountId.HasValue, canEdit);
        }).OrderByDescending(x => x.IsShared).ThenByDescending(x => x.HealthPercent).ToList();
    }

    private static double StandardDeviation(IEnumerable<double> values)
    {
        var data = values.ToArray();
        if (data.Length == 0) return 0;
        var average = data.Average();
        var variance = data.Sum(x => Math.Pow(x - average, 2)) / data.Length;
        return Math.Sqrt(variance);
    }
}

public interface IRuleEngineService
{
    Task<(Guid? categoryId, List<string> tags, List<string> alerts)> ApplyAsync(Guid userId, TransactionUpsertRequest request, CancellationToken cancellationToken);
}

public sealed class RuleEngineService(AppDbContext dbContext) : IRuleEngineService
{
    public async Task<(Guid? categoryId, List<string> tags, List<string> alerts)> ApplyAsync(Guid userId, TransactionUpsertRequest request, CancellationToken cancellationToken)
    {
        var rules = await dbContext.Rules.Where(x => x.UserId == userId && x.IsActive).OrderBy(x => x.Priority).ToListAsync(cancellationToken);
        Guid? categoryId = request.CategoryId;
        var tags = new List<string>(request.Tags);
        var alerts = new List<string>();

        foreach (var rule in rules)
        {
            var conditions = JsonSerializer.Deserialize<List<RuleConditionDto>>(rule.ConditionJson) ?? [];
            var actions = JsonSerializer.Deserialize<List<RuleActionDto>>(rule.ActionJson) ?? [];
            if (!conditions.All(condition => Matches(condition, request))) continue;

            foreach (var action in actions)
            {
                switch (action.Type)
                {
                    case RuleActionType.SetCategory when Guid.TryParse(action.Value, out var parsedCategory):
                        categoryId = parsedCategory;
                        break;
                    case RuleActionType.AddTag:
                        if (!tags.Contains(action.Value, StringComparer.OrdinalIgnoreCase)) tags.Add(action.Value);
                        break;
                    case RuleActionType.TriggerAlert:
                    case RuleActionType.FlagReview:
                        alerts.Add(action.Value);
                        break;
                }
            }
        }

        return (categoryId, tags, alerts);
    }

    private static bool Matches(RuleConditionDto condition, TransactionUpsertRequest request)
    {
        var value = condition.Field.ToLowerInvariant() switch
        {
            "merchant" => request.Merchant,
            "note" => request.Note,
            "amount" => request.Amount.ToString(),
            "type" => request.Type.ToString(),
            _ => string.Empty
        };

        return condition.Operator switch
        {
            RuleOperator.Equals => string.Equals(value, condition.Value, StringComparison.OrdinalIgnoreCase),
            RuleOperator.Contains => value.Contains(condition.Value, StringComparison.OrdinalIgnoreCase),
            RuleOperator.StartsWith => value.StartsWith(condition.Value, StringComparison.OrdinalIgnoreCase),
            RuleOperator.GreaterThan => decimal.TryParse(value, out var numericValue) && numericValue > decimal.Parse(condition.Value),
            RuleOperator.LessThan => decimal.TryParse(value, out var lessValue) && lessValue < decimal.Parse(condition.Value),
            RuleOperator.InList => condition.Value.Split(',', StringSplitOptions.TrimEntries).Contains(value, StringComparer.OrdinalIgnoreCase),
            _ => false
        };
    }
}




