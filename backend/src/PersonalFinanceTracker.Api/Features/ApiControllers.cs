using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PersonalFinanceTracker.Api.Common;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Domain.Enums;
using PersonalFinanceTracker.Api.Persistence;
using PersonalFinanceTracker.Api.Services;

namespace PersonalFinanceTracker.Api.Features;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        if (request.Password.Length < 8) return BadRequest("Password must be at least 8 characters.");
        return Ok(await authService.RegisterAsync(request, cancellationToken));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var response = await authService.LoginAsync(request, cancellationToken);
        return response is null ? Unauthorized() : Ok(response);
    }

    [HttpPost("google")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Google([FromBody] GoogleLoginRequest request, CancellationToken cancellationToken)
    {
        var response = await authService.GoogleLoginAsync(request, cancellationToken);
        return response is null ? Unauthorized() : Ok(response);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] string refreshToken, CancellationToken cancellationToken)
    {
        var response = await authService.RefreshAsync(refreshToken, cancellationToken);
        return response is null ? Unauthorized() : Ok(response);
    }
}

[ApiController]
[Authorize]
[Route("api/accounts")]
public sealed class AccountsController(AppDbContext dbContext, ICurrentUserService currentUserService, IAccountAccessService accessService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AccountDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var accountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var accounts = await dbContext.Accounts.Where(x => accountIds.Contains(x.Id)).OrderByDescending(x => x.CurrentBalance)
            .Select(x => new AccountDto(x.Id, x.Name, x.Type, x.OpeningBalance, x.CurrentBalance, x.Color, x.Icon, x.InstitutionName))
            .ToListAsync(cancellationToken);
        return Ok(accounts);
    }

    [HttpPost]
    public async Task<ActionResult<AccountDto>> Create([FromBody] AccountUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var account = new Account { UserId = userId, Name = request.Name, Type = request.Type, OpeningBalance = request.OpeningBalance, CurrentBalance = request.OpeningBalance, Color = request.Color, Icon = request.Icon, InstitutionName = request.InstitutionName };
        dbContext.Accounts.Add(account);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new AccountDto(account.Id, account.Name, account.Type, account.OpeningBalance, account.CurrentBalance, account.Color, account.Icon, account.InstitutionName));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AccountDto>> Update(Guid id, [FromBody] AccountUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        if (!await accessService.CanEditAsync(userId, id, cancellationToken)) return Forbid();
        var account = await dbContext.Accounts.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (account is null) return NotFound();
        account.Name = request.Name;
        account.Type = request.Type;
        account.Color = request.Color;
        account.Icon = request.Icon;
        account.InstitutionName = request.InstitutionName;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new AccountDto(account.Id, account.Name, account.Type, account.OpeningBalance, account.CurrentBalance, account.Color, account.Icon, account.InstitutionName));
    }
}

[ApiController]
[Authorize]
[Route("api/categories")]
public sealed class CategoriesController(AppDbContext dbContext, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var categories = await dbContext.Categories.Where(x => x.UserId == userId).OrderBy(x => x.Type).ThenBy(x => x.Name)
            .Select(x => new CategoryDto(x.Id, x.Name, x.Type, x.Color, x.Icon, x.IsArchived))
            .ToListAsync(cancellationToken);
        return Ok(categories);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CategoryUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var category = new Category { UserId = userId, Name = request.Name, Type = request.Type, Color = request.Color, Icon = request.Icon, IsArchived = request.IsArchived };
        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new CategoryDto(category.Id, category.Name, category.Type, category.Color, category.Icon, category.IsArchived));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CategoryDto>> Update(Guid id, [FromBody] CategoryUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var category = await dbContext.Categories.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (category is null) return NotFound();
        category.Name = request.Name;
        category.Type = request.Type;
        category.Color = request.Color;
        category.Icon = request.Icon;
        category.IsArchived = request.IsArchived;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new CategoryDto(category.Id, category.Name, category.Type, category.Color, category.Icon, category.IsArchived));
    }
}

[ApiController]
[Authorize]
[Route("api/transactions")]
public sealed class TransactionsController(AppDbContext dbContext, ICurrentUserService currentUserService, IAccountBalanceService balanceService, IRuleEngineService ruleEngineService, IAccountAccessService accessService, INotificationService notificationService, IAuditService auditService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TransactionDto>>> Get([FromQuery] string? search, [FromQuery] Guid? accountId, [FromQuery] Guid? categoryId, [FromQuery] TransactionType? type, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var userId = currentUserService.GetUserId();
        var accountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var query = dbContext.Transactions.Include(x => x.Account).Include(x => x.Category).Where(x => accountIds.Contains(x.AccountId) || (x.TransferAccountId.HasValue && accountIds.Contains(x.TransferAccountId.Value)));
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Merchant.Contains(search) || x.Note.Contains(search));
        if (accountId.HasValue) query = query.Where(x => x.AccountId == accountId.Value || x.TransferAccountId == accountId.Value);
        if (categoryId.HasValue) query = query.Where(x => x.CategoryId == categoryId.Value);
        if (type.HasValue) query = query.Where(x => x.Type == type.Value);
        var normalizedFrom = UtcDateTime.EnsureUtc(from);
        var normalizedTo = UtcDateTime.EnsureUtc(to);
        if (normalizedFrom.HasValue) query = query.Where(x => x.TransactionDate >= normalizedFrom.Value);
        if (normalizedTo.HasValue) query = query.Where(x => x.TransactionDate <= normalizedTo.Value);

        var transactions = await query.OrderByDescending(x => x.TransactionDate).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return Ok(transactions.Select(AnalyticsService.MapTransaction).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<TransactionDto>> Create([FromBody] TransactionUpsertRequest request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");
        if (request.Type == TransactionType.Transfer && request.TransferAccountId is null) return BadRequest("Transfer destination is required.");
        if (request.Type != TransactionType.Transfer && request.CategoryId is null) return BadRequest("Category is required.");

        var userId = currentUserService.GetUserId();
        if (!await accessService.CanEditAsync(userId, request.AccountId, cancellationToken)) return Forbid();
        if (request.TransferAccountId.HasValue && !await accessService.CanEditAsync(userId, request.TransferAccountId.Value, cancellationToken)) return Forbid();

        var primaryAccount = await dbContext.Accounts.FirstAsync(x => x.Id == request.AccountId, cancellationToken);
        var scopeUserId = primaryAccount.UserId;
        var ruleResult = await ruleEngineService.ApplyAsync(scopeUserId, request, cancellationToken);
        var transaction = new Transaction
        {
            UserId = scopeUserId,
            AccountId = request.AccountId,
            TransferAccountId = request.TransferAccountId,
            CategoryId = ruleResult.categoryId ?? request.CategoryId,
            Type = request.Type,
            Amount = request.Amount,
            TransactionDate = UtcDateTime.EnsureUtc(request.TransactionDate),
            Merchant = request.Merchant,
            Note = request.Note,
            PaymentMethod = request.PaymentMethod,
            TagsJson = JsonSerializer.Serialize(ruleResult.tags)
        };

        dbContext.Transactions.Add(transaction);
        await dbContext.SaveChangesAsync(cancellationToken);
        await balanceService.RecalculateAsync(scopeUserId, cancellationToken);
        await notificationService.CreateAsync(userId, NotificationType.TransactionSaved, "Transaction saved", request.Merchant, null, false, cancellationToken);
        foreach (var alert in ruleResult.alerts)
        {
            await notificationService.CreateAsync(userId, NotificationType.RuleTriggered, "Rule triggered", alert, null, true, cancellationToken);
        }
        await notificationService.SyncFinancialAlertsAsync(scopeUserId, cancellationToken);
        await auditService.LogAsync(userId, "transaction", transaction.Id, "created", new { transaction.Merchant, transaction.Amount }, cancellationToken);

        transaction = await dbContext.Transactions.Include(x => x.Account).Include(x => x.Category).FirstAsync(x => x.Id == transaction.Id, cancellationToken);
        return Ok(AnalyticsService.MapTransaction(transaction));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TransactionDto>> Update(Guid id, [FromBody] TransactionUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var transaction = await dbContext.Transactions.Include(x => x.Account).Include(x => x.Category).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (transaction is null) return NotFound();
        if (!await accessService.CanEditAsync(userId, transaction.AccountId, cancellationToken)) return Forbid();
        if (!await accessService.CanEditAsync(userId, request.AccountId, cancellationToken)) return Forbid();
        if (request.TransferAccountId.HasValue && !await accessService.CanEditAsync(userId, request.TransferAccountId.Value, cancellationToken)) return Forbid();
        transaction.AccountId = request.AccountId;
        transaction.TransferAccountId = request.TransferAccountId;
        transaction.CategoryId = request.CategoryId;
        transaction.Type = request.Type;
        transaction.Amount = request.Amount;
        transaction.TransactionDate = UtcDateTime.EnsureUtc(request.TransactionDate);
        transaction.Merchant = request.Merchant;
        transaction.Note = request.Note;
        transaction.PaymentMethod = request.PaymentMethod;
        transaction.TagsJson = JsonSerializer.Serialize(request.Tags);
        transaction.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await balanceService.RecalculateAsync(transaction.UserId, cancellationToken);
        await notificationService.SyncFinancialAlertsAsync(transaction.UserId, cancellationToken);
        await auditService.LogAsync(userId, "transaction", transaction.Id, "updated", new { transaction.Merchant, transaction.Amount }, cancellationToken);
        return Ok(AnalyticsService.MapTransaction(transaction));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var transaction = await dbContext.Transactions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (transaction is null) return NotFound();
        if (!await accessService.CanEditAsync(userId, transaction.AccountId, cancellationToken)) return Forbid();
        dbContext.Transactions.Remove(transaction);
        await dbContext.SaveChangesAsync(cancellationToken);
        await balanceService.RecalculateAsync(transaction.UserId, cancellationToken);
        await notificationService.SyncFinancialAlertsAsync(transaction.UserId, cancellationToken);
        await auditService.LogAsync(userId, "transaction", transaction.Id, "deleted", new { transaction.Merchant, transaction.Amount }, cancellationToken);
        return NoContent();
    }

    [HttpPost("quick-parse")]
    public ActionResult<QuickAddParseResponse> QuickParse([FromBody] QuickAddParseRequest request)
    {
        var text = request.Input.Trim();
        var type = text.Contains("salary", StringComparison.OrdinalIgnoreCase) || text.Contains("received", StringComparison.OrdinalIgnoreCase)
            ? TransactionType.Income
            : TransactionType.Expense;
        var amountToken = text.Split(' ').FirstOrDefault(part => decimal.TryParse(part, out _));
        var amount = amountToken is null ? 0 : decimal.Parse(amountToken);
        var categoryHint = text.Contains("grocery", StringComparison.OrdinalIgnoreCase) || text.Contains("food", StringComparison.OrdinalIgnoreCase) ? "Food"
            : text.Contains("netflix", StringComparison.OrdinalIgnoreCase) ? "Subscriptions"
            : text.Contains("uber", StringComparison.OrdinalIgnoreCase) ? "Transport"
            : type == TransactionType.Income ? "Salary" : null;
        var accountHint = text.Contains("card", StringComparison.OrdinalIgnoreCase) ? "Travel Card" : text.Contains("bank", StringComparison.OrdinalIgnoreCase) ? "Salary Account" : null;
        var merchant = text.Split(" on ", StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Replace("spent", string.Empty, StringComparison.OrdinalIgnoreCase).Trim() ?? text;
        var chips = new List<string> { type.ToString(), amount.ToString("0.##") };
        if (!string.IsNullOrWhiteSpace(categoryHint)) chips.Add(categoryHint);
        if (!string.IsNullOrWhiteSpace(accountHint)) chips.Add(accountHint);
        return Ok(new QuickAddParseResponse(type, amount, categoryHint, accountHint, merchant, UtcDateTime.StartOfDayUtc(DateTime.UtcNow), chips));
    }
}

[ApiController]
[Authorize]
[Route("api/budgets")]
public sealed class BudgetsController(AppDbContext dbContext, ICurrentUserService currentUserService, IAnalyticsService analyticsService, IAccountAccessService accessService, INotificationService notificationService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BudgetDto>>> Get([FromQuery] int? month, [FromQuery] int? year, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var targetMonth = month ?? now.Month;
        var targetYear = year ?? now.Year;
        return Ok(await analyticsService.GetBudgetsAsync(currentUserService.GetUserId(), targetMonth, targetYear, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] BudgetUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var scopeUserId = userId;
        if (request.AccountId.HasValue)
        {
            if (!await accessService.CanEditAsync(userId, request.AccountId.Value, cancellationToken)) return Forbid();
            scopeUserId = await dbContext.Accounts.Where(x => x.Id == request.AccountId.Value).Select(x => x.UserId).FirstAsync(cancellationToken);
        }

        var exists = await dbContext.Budgets.AnyAsync(x => x.UserId == scopeUserId && x.CategoryId == request.CategoryId && x.Month == request.Month && x.Year == request.Year && x.AccountId == request.AccountId, cancellationToken);
        if (exists) return Conflict("A budget already exists for this category, month, year, and account scope.");

        dbContext.Budgets.Add(new Budget { UserId = scopeUserId, CategoryId = request.CategoryId, AccountId = request.AccountId, Month = request.Month, Year = request.Year, Amount = request.Amount, AlertThresholdPercent = request.AlertThresholdPercent });
        await dbContext.SaveChangesAsync(cancellationToken);
        await notificationService.SyncFinancialAlertsAsync(userId, cancellationToken);
        return Ok();
    }
}

[ApiController]
[Authorize]
[Route("api/goals")]
public sealed class GoalsController(AppDbContext dbContext, ICurrentUserService currentUserService, IAccountAccessService accessService, INotificationService notificationService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GoalDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var accountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var goals = await dbContext.Goals
            .Include(x => x.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.Members)
                    .ThenInclude(x => x.User)
            .Where(x => x.UserId == userId || (x.LinkedAccountId.HasValue && accountIds.Contains(x.LinkedAccountId.Value)))
            .OrderBy(x => x.TargetDate ?? DateTime.MaxValue)
            .ToListAsync(cancellationToken);

        return Ok(goals.Select(AnalyticsService.MapGoal).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<GoalDto>> Create([FromBody] GoalUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var scopeUserId = userId;
        if (request.LinkedAccountId.HasValue)
        {
            if (!await accessService.CanEditAsync(userId, request.LinkedAccountId.Value, cancellationToken)) return Forbid();
            scopeUserId = await dbContext.Accounts.Where(x => x.Id == request.LinkedAccountId.Value).Select(x => x.UserId).FirstAsync(cancellationToken);
        }

        var goal = new Goal
        {
            UserId = scopeUserId,
            Name = request.Name,
            TargetAmount = request.TargetAmount,
            TargetDate = UtcDateTime.EnsureUtc(request.TargetDate),
            LinkedAccountId = request.LinkedAccountId,
            Icon = request.Icon,
            Color = request.Color
        };
        dbContext.Goals.Add(goal);
        await dbContext.SaveChangesAsync(cancellationToken);

        goal = await dbContext.Goals
            .Include(x => x.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.Members)
                    .ThenInclude(x => x.User)
            .FirstAsync(x => x.Id == goal.Id, cancellationToken);

        if (goal.LinkedAccountId.HasValue)
        {
            await NotifyGoalParticipantsAsync(goal, $"Shared goal created: {goal.Name}", $"A shared goal has been created for {goal.Name}.", cancellationToken);
        }

        return Ok(AnalyticsService.MapGoal(goal));
    }

    [HttpPost("{id:guid}/entries")]
    public async Task<ActionResult<GoalDto>> AddEntry(Guid id, [FromBody] GoalEntryRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var goal = await dbContext.Goals
            .Include(x => x.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.Members)
                    .ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (goal is null) return NotFound();
        if (!await CanEditGoalAsync(goal, userId, cancellationToken)) return Forbid();
        if (request.AccountId.HasValue && !await accessService.CanEditAsync(userId, request.AccountId.Value, cancellationToken)) return Forbid();

        goal.CurrentAmount += request.Type == GoalEntryType.Contribution ? request.Amount : -request.Amount;
        goal.CurrentAmount = Math.Max(0, goal.CurrentAmount);
        if (goal.CurrentAmount >= goal.TargetAmount) goal.Status = GoalStatus.Completed;
        dbContext.GoalEntries.Add(new GoalEntry { GoalId = goal.Id, UserId = userId, AccountId = request.AccountId, Type = request.Type, Amount = request.Amount, Note = request.Note });
        await dbContext.SaveChangesAsync(cancellationToken);

        if (goal.Status == GoalStatus.Completed)
        {
            await NotifyGoalParticipantsAsync(goal, $"Goal reached: {goal.Name}", $"The shared goal \"{goal.Name}\" has been completed.", cancellationToken);
        }

        return Ok(AnalyticsService.MapGoal(goal));
    }

    private async Task<bool> CanEditGoalAsync(Goal goal, Guid userId, CancellationToken cancellationToken)
    {
        if (goal.LinkedAccountId.HasValue)
        {
            return await accessService.CanEditAsync(userId, goal.LinkedAccountId.Value, cancellationToken);
        }

        return goal.UserId == userId;
    }

    private async Task NotifyGoalParticipantsAsync(Goal goal, string title, string body, CancellationToken cancellationToken)
    {
        var recipients = new HashSet<Guid> { goal.UserId };
        if (goal.LinkedAccount is not null)
        {
            foreach (var member in goal.LinkedAccount.Members)
            {
                recipients.Add(member.UserId);
            }
        }

        foreach (var recipient in recipients)
        {
            await notificationService.CreateAsync(recipient, NotificationType.GoalReached, title, body, new { goal.Id, goal.LinkedAccountId }, true, cancellationToken);
        }
    }
}

[ApiController]
[Authorize]
[Route("api/recurring")]
public sealed class RecurringController(AppDbContext dbContext, ICurrentUserService currentUserService, IAccountAccessService accessService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RecurringItemDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var accountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var items = await dbContext.RecurringTransactions
            .Include(x => x.Account)
            .Include(x => x.Category)
            .Where(x => x.UserId == userId || accountIds.Contains(x.AccountId))
            .OrderBy(x => x.NextRunDate)
            .ToListAsync(cancellationToken);
        return Ok(items.Select(AnalyticsService.MapRecurring).ToList());
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] RecurringUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        if (!await accessService.CanEditAsync(userId, request.AccountId, cancellationToken)) return Forbid();
        var scopeUserId = await dbContext.Accounts.Where(x => x.Id == request.AccountId).Select(x => x.UserId).FirstAsync(cancellationToken);
        var normalizedStartDate = UtcDateTime.EnsureUtc(request.StartDate);
        var normalizedEndDate = UtcDateTime.EnsureUtc(request.EndDate);
        dbContext.RecurringTransactions.Add(new RecurringTransaction { UserId = scopeUserId, Title = request.Title, Type = request.Type, Amount = request.Amount, AccountId = request.AccountId, CategoryId = request.CategoryId, Frequency = request.Frequency, StartDate = normalizedStartDate, EndDate = normalizedEndDate, NextRunDate = normalizedStartDate, AutoCreateTransaction = request.AutoCreateTransaction, IsPaused = request.IsPaused });
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }
}

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController(IAnalyticsService analyticsService, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardResponse>> Get(CancellationToken cancellationToken)
        => Ok(await analyticsService.GetDashboardAsync(currentUserService.GetUserId(), cancellationToken));
}

[ApiController]
[Authorize]
[Route("api/reports")]
public sealed class ReportsController(IAnalyticsService analyticsService, ICurrentUserService currentUserService, AppDbContext dbContext, IAccountAccessService accessService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ReportResponse>> Get([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? accountId, [FromQuery] Guid? categoryId, [FromQuery] TransactionType? type, CancellationToken cancellationToken)
        => Ok(await analyticsService.GetReportsAsync(currentUserService.GetUserId(), from, to, accountId, categoryId, type, cancellationToken));

    [HttpGet("trends")]
    public async Task<ActionResult<ReportResponse>> Trends([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? accountId, [FromQuery] Guid? categoryId, [FromQuery] TransactionType? type, CancellationToken cancellationToken)
        => Ok(await analyticsService.GetReportsAsync(currentUserService.GetUserId(), from, to, accountId, categoryId, type, cancellationToken));

    [HttpGet("net-worth")]
    public async Task<ActionResult<object>> NetWorth(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var accountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var accounts = await dbContext.Accounts.Where(x => accountIds.Contains(x.Id)).ToListAsync(cancellationToken);
        return Ok(new { total = accounts.Sum(x => x.CurrentBalance), accounts = accounts.Select(x => new { x.Name, x.CurrentBalance }) });
    }

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportCsv([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? accountId, [FromQuery] Guid? categoryId, [FromQuery] TransactionType? type, CancellationToken cancellationToken)
    {
        var report = await analyticsService.GetReportsAsync(currentUserService.GetUserId(), from, to, accountId, categoryId, type, cancellationToken);
        var builder = new StringBuilder();
        builder.AppendLine("label,income,expense,balance");
        foreach (var point in report.MonthlyTrend) builder.AppendLine($"{point.Label},{point.Income},{point.Expense},{point.Balance}");
        return File(Encoding.UTF8.GetBytes(builder.ToString()), "text/csv", "reports.csv");
    }
}

[ApiController]
[Authorize]
[Route("api/forecast")]
public sealed class ForecastController(IAnalyticsService analyticsService, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet("month")]
    public async Task<ActionResult<ForecastMonthResponse>> Month(CancellationToken cancellationToken)
        => Ok(await analyticsService.GetForecastMonthAsync(currentUserService.GetUserId(), cancellationToken));

    [HttpGet("daily")]
    public async Task<ActionResult<IReadOnlyList<ForecastDailyPoint>>> Daily(CancellationToken cancellationToken)
        => Ok(await analyticsService.GetForecastDailyAsync(currentUserService.GetUserId(), cancellationToken));
}

[ApiController]
[Authorize]
[Route("api/insights")]
public sealed class InsightsController(IAnalyticsService analyticsService, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InsightCardDto>>> Get(CancellationToken cancellationToken)
        => Ok(await analyticsService.GetInsightsAsync(currentUserService.GetUserId(), cancellationToken));

    [HttpGet("health-score")]
    public async Task<ActionResult<HealthScoreResponse>> HealthScore(CancellationToken cancellationToken)
        => Ok(await analyticsService.GetHealthScoreAsync(currentUserService.GetUserId(), cancellationToken));
}

[ApiController]
[Authorize]
[Route("api/rules")]
public sealed class RulesController(AppDbContext dbContext, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RuleDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var rules = await dbContext.Rules.Where(x => x.UserId == userId).OrderBy(x => x.Priority).ToListAsync(cancellationToken);
        var mapped = rules.Select(x => new RuleDto(x.Id, x.Priority, x.IsActive, JsonSerializer.Deserialize<List<RuleConditionDto>>(x.ConditionJson) ?? [], JsonSerializer.Deserialize<List<RuleActionDto>>(x.ActionJson) ?? [])).ToList();
        return Ok(mapped);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] RuleUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        dbContext.Rules.Add(new Rule { UserId = userId, Priority = request.Priority, IsActive = request.IsActive, ConditionJson = JsonSerializer.Serialize(request.Conditions), ActionJson = JsonSerializer.Serialize(request.Actions) });
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] RuleUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var rule = await dbContext.Rules.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (rule is null) return NotFound();
        rule.Priority = request.Priority;
        rule.IsActive = request.IsActive;
        rule.ConditionJson = JsonSerializer.Serialize(request.Conditions);
        rule.ActionJson = JsonSerializer.Serialize(request.Actions);
        rule.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }
}




