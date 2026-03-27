using Microsoft.AspNetCore.Authorization;
using PersonalFinanceTracker.Api.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Domain.Enums;
using PersonalFinanceTracker.Api.Persistence;
using PersonalFinanceTracker.Api.Services;

namespace PersonalFinanceTracker.Api.Features;

[ApiController]
[Authorize]
[Route("api/budgets")]
public sealed class BudgetManagementController(AppDbContext dbContext, ICurrentUserService currentUserService, INotificationService notificationService, IAccountAccessService accessService) : ControllerBase
{
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BudgetUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var budget = await dbContext.Budgets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (budget is null) return NotFound();
        if (budget.AccountId.HasValue)
        {
            if (!await accessService.CanEditAsync(userId, budget.AccountId.Value, cancellationToken)) return Forbid();
        }
        else if (budget.UserId != userId)
        {
            return Forbid();
        }

        if (request.AccountId.HasValue && !await accessService.CanEditAsync(userId, request.AccountId.Value, cancellationToken)) return Forbid();
        var scopeUserId = request.AccountId.HasValue
            ? await dbContext.Accounts.Where(x => x.Id == request.AccountId.Value).Select(x => x.UserId).FirstAsync(cancellationToken)
            : userId;
        var duplicateExists = await dbContext.Budgets.AnyAsync(x => x.Id != id && x.UserId == scopeUserId && x.CategoryId == request.CategoryId && x.Month == request.Month && x.Year == request.Year && x.AccountId == request.AccountId, cancellationToken);
        if (duplicateExists) return Conflict("A budget already exists for this category, month, year, and account scope.");

        budget.UserId = scopeUserId;
        budget.CategoryId = request.CategoryId;
        budget.AccountId = request.AccountId;
        budget.Month = request.Month;
        budget.Year = request.Year;
        budget.Amount = request.Amount;
        budget.AlertThresholdPercent = request.AlertThresholdPercent;
        await dbContext.SaveChangesAsync(cancellationToken);
        await notificationService.SyncFinancialAlertsAsync(userId, cancellationToken);
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var budget = await dbContext.Budgets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (budget is null) return NotFound();
        if (budget.AccountId.HasValue)
        {
            if (!await accessService.CanEditAsync(userId, budget.AccountId.Value, cancellationToken)) return Forbid();
        }
        else if (budget.UserId != userId)
        {
            return Forbid();
        }
        dbContext.Budgets.Remove(budget);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("duplicate-last-month")]
    public async Task<IActionResult> DuplicateLastMonth(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var now = DateTime.UtcNow;
        var previous = now.AddMonths(-1);
        var editableAccountIds = await dbContext.AccountMembers.Where(x => x.UserId == userId && x.Role != SharedRole.Viewer).Select(x => x.AccountId).ToListAsync(cancellationToken);
        var lastMonthBudgets = await dbContext.Budgets
            .Where(x => x.Month == previous.Month && x.Year == previous.Year && (x.UserId == userId || (x.AccountId.HasValue && editableAccountIds.Contains(x.AccountId.Value))))
            .ToListAsync(cancellationToken);
        foreach (var budget in lastMonthBudgets)
        {
            var exists = await dbContext.Budgets.AnyAsync(x => x.UserId == budget.UserId && x.CategoryId == budget.CategoryId && x.Month == now.Month && x.Year == now.Year && x.AccountId == budget.AccountId, cancellationToken);
            if (!exists)
            {
                dbContext.Budgets.Add(new Budget { UserId = budget.UserId, CategoryId = budget.CategoryId, AccountId = budget.AccountId, Month = now.Month, Year = now.Year, Amount = budget.Amount, AlertThresholdPercent = budget.AlertThresholdPercent });
            }
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }
}

[ApiController]
[Authorize]
[Route("api/goals")]
public sealed class GoalManagementController(AppDbContext dbContext, ICurrentUserService currentUserService, INotificationService notificationService, IAccountAccessService accessService) : ControllerBase
{
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] GoalUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var goal = await dbContext.Goals
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.Members)
                    .ThenInclude(x => x.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.User)
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (goal is null) return NotFound();
        if (!await CanEditGoalAsync(goal, userId, cancellationToken)) return Forbid();
        if (request.LinkedAccountId.HasValue && !await accessService.CanEditAsync(userId, request.LinkedAccountId.Value, cancellationToken)) return Forbid();

        goal.Name = request.Name;
        goal.TargetAmount = request.TargetAmount;
        goal.TargetDate = UtcDateTime.EnsureUtc(request.TargetDate);
        goal.LinkedAccountId = request.LinkedAccountId;
        goal.Icon = request.Icon;
        goal.Color = request.Color;
        if (request.LinkedAccountId.HasValue)
        {
            goal.UserId = await dbContext.Accounts.Where(x => x.Id == request.LinkedAccountId.Value).Select(x => x.UserId).FirstAsync(cancellationToken);
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(AnalyticsService.MapGoal(goal));
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> MarkComplete(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var goal = await dbContext.Goals
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.Members)
                    .ThenInclude(x => x.User)
            .Include(x => x.LinkedAccount)
                .ThenInclude(x => x!.User)
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (goal is null) return NotFound();
        if (!await CanEditGoalAsync(goal, userId, cancellationToken)) return Forbid();
        goal.Status = GoalStatus.Completed;
        goal.CurrentAmount = Math.Max(goal.CurrentAmount, goal.TargetAmount);
        await dbContext.SaveChangesAsync(cancellationToken);
        await NotifyGoalParticipantsAsync(goal, $"Goal reached: {goal.Name}", $"You completed the {goal.Name} goal.", cancellationToken);
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
public sealed class RecurringManagementController(AppDbContext dbContext, ICurrentUserService currentUserService, IAccountAccessService accessService) : ControllerBase
{
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] RecurringUpsertRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var recurring = await dbContext.RecurringTransactions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (recurring is null) return NotFound();
        if (!await accessService.CanEditAsync(userId, recurring.AccountId, cancellationToken)) return Forbid();
        if (!await accessService.CanEditAsync(userId, request.AccountId, cancellationToken)) return Forbid();
        recurring.Title = request.Title;
        recurring.Type = request.Type;
        recurring.Amount = request.Amount;
        recurring.AccountId = request.AccountId;
        recurring.CategoryId = request.CategoryId;
        recurring.Frequency = request.Frequency;
        recurring.StartDate = UtcDateTime.EnsureUtc(request.StartDate);
        recurring.EndDate = UtcDateTime.EnsureUtc(request.EndDate);
        recurring.AutoCreateTransaction = request.AutoCreateTransaction;
        recurring.IsPaused = request.IsPaused;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var recurring = await dbContext.RecurringTransactions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (recurring is null) return NotFound();
        if (!await accessService.CanEditAsync(userId, recurring.AccountId, cancellationToken)) return Forbid();
        recurring.IsPaused = true;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPost("{id:guid}/resume")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var recurring = await dbContext.RecurringTransactions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (recurring is null) return NotFound();
        if (!await accessService.CanEditAsync(userId, recurring.AccountId, cancellationToken)) return Forbid();
        recurring.IsPaused = false;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var recurring = await dbContext.RecurringTransactions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (recurring is null) return NotFound();
        if (!await accessService.CanEditAsync(userId, recurring.AccountId, cancellationToken)) return Forbid();
        dbContext.RecurringTransactions.Remove(recurring);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Authorize]
[Route("api/rules")]
public sealed class RuleManagementController(AppDbContext dbContext, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var rule = await dbContext.Rules.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (rule is null) return NotFound();
        dbContext.Rules.Remove(rule);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}





