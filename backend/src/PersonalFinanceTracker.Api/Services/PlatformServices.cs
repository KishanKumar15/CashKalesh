using System.Net;
using System.Net.Mail;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PersonalFinanceTracker.Api.Common;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Domain.Enums;
using PersonalFinanceTracker.Api.Persistence;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PersonalFinanceTracker.Api.Services;

public sealed class AppBrandingOptions
{
    public string AppName { get; set; } = "CashKalesh";
    public string DefaultCurrency { get; set; } = "INR";
    public string DefaultLocale { get; set; } = "en-IN";
    public string NotificationMode { get; set; } = "both";
    public string DeploymentTarget { get; set; } = "Local and Podman";
    public string PdfExportStyle { get; set; } = "branded";
    public string FrontendBaseUrl { get; set; } = "http://localhost:5173";
}

public sealed class EmailOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
}

public interface IEmailService
{
    Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken);
}

public sealed class EmailService(IOptions<EmailOptions> emailOptions, ILogger<EmailService> logger) : IEmailService
{
    private readonly EmailOptions _emailOptions = emailOptions.Value;

    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_emailOptions.Host) || string.IsNullOrWhiteSpace(_emailOptions.Username) || string.IsNullOrWhiteSpace(_emailOptions.Password))
        {
            logger.LogWarning("Email configuration is incomplete. Skipping outbound mail to {Email}.", toEmail);
            return;
        }

        using var message = new MailMessage
        {
            From = new MailAddress(_emailOptions.FromEmail, _emailOptions.FromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(toEmail);

        using var client = new SmtpClient(_emailOptions.Host, _emailOptions.Port)
        {
            EnableSsl = true,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(_emailOptions.Username, _emailOptions.Password)
        };

        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            await client.SendMailAsync(message, cancellationToken);
        }
        catch (SmtpException exception)
        {
            logger.LogError(exception, "Unable to send email to {Email} using SMTP host {Host}:{Port}.", toEmail, _emailOptions.Host, _emailOptions.Port);
            throw new InvalidOperationException("We could not send the email right now. Please try again in a moment.");
        }
    }
}

public interface INotificationService
{
    Task<NotificationDto> CreateAsync(Guid userId, NotificationType type, string title, string body, object? metadata, bool sendEmail, CancellationToken cancellationToken);
    Task SyncFinancialAlertsAsync(Guid userId, CancellationToken cancellationToken);
}

public sealed class NotificationService(AppDbContext dbContext, IEmailService emailService, IOptions<AppBrandingOptions> brandingOptions, IAccountAccessService accessService) : INotificationService
{
    private readonly AppBrandingOptions _branding = brandingOptions.Value;

    public async Task<NotificationDto> CreateAsync(Guid userId, NotificationType type, string title, string body, object? metadata, bool sendEmail, CancellationToken cancellationToken)
    {
        var metadataJson = metadata is null ? "{}" : JsonSerializer.Serialize(metadata);
        var notification = new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Body = body,
            MetadataJson = metadataJson
        };

        dbContext.Notifications.Add(notification);
        await dbContext.SaveChangesAsync(cancellationToken);

        var shouldEmail = sendEmail && (_branding.NotificationMode.Equals("both", StringComparison.OrdinalIgnoreCase) || _branding.NotificationMode.Equals("email", StringComparison.OrdinalIgnoreCase));
        if (shouldEmail)
        {
            var user = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            await emailService.SendAsync(user.Email, $"{_branding.AppName}: {title}", $"<h2>{title}</h2><p>{body}</p>", cancellationToken);
            notification.EmailSent = true;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return new NotificationDto(notification.Id, notification.Type, notification.Title, notification.Body, notification.EmailSent, notification.CreatedAt, notification.ReadAt);
    }

    public async Task SyncFinancialAlertsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var accessibleAccountIds = await accessService.GetAccessibleAccountIdsAsync(userId, cancellationToken);
        var ownedAccountIds = await dbContext.Accounts.Where(x => x.UserId == userId).Select(x => x.Id).ToListAsync(cancellationToken);
        var dashboardBudgets = await dbContext.Budgets
            .Include(x => x.Category)
            .Where(x => x.Month == now.Month && x.Year == now.Year && (x.UserId == userId || (x.AccountId.HasValue && accessibleAccountIds.Contains(x.AccountId.Value))))
            .ToListAsync(cancellationToken);
        var monthStart = UtcDateTime.StartOfMonthUtc(now);
        var monthTransactions = await dbContext.Transactions
            .Where(x => x.TransactionDate >= monthStart && (ownedAccountIds.Contains(x.AccountId) || accessibleAccountIds.Contains(x.AccountId)))
            .ToListAsync(cancellationToken);
        var ownedAccountSet = ownedAccountIds.ToHashSet();

        foreach (var budget in dashboardBudgets)
        {
            var spent = budget.AccountId.HasValue
                ? monthTransactions.Where(x => x.Type == TransactionType.Expense && x.AccountId == budget.AccountId.Value && x.CategoryId == budget.CategoryId).Sum(x => x.Amount)
                : monthTransactions.Where(x => x.Type == TransactionType.Expense && ownedAccountSet.Contains(x.AccountId) && x.CategoryId == budget.CategoryId).Sum(x => x.Amount);
            var percent = budget.Amount == 0 ? 0 : (int)Math.Floor((spent / budget.Amount) * 100);
            var budgetLabel = budget.AccountId.HasValue ? $"{budget.Category?.Name} on shared account" : budget.Category?.Name;
            if (percent >= 120)
            {
                await EnsureNotificationAsync(userId, NotificationType.BudgetExceeded, $"{budgetLabel} crossed 120%", $"Your {budget.Category?.Name} budget is at {percent}% this month.", cancellationToken);
            }
            else if (percent >= 100)
            {
                await EnsureNotificationAsync(userId, NotificationType.BudgetExceeded, $"{budgetLabel} budget exceeded", $"Your {budget.Category?.Name} budget is at {percent}% this month.", cancellationToken);
            }
            else if (percent >= 80)
            {
                await EnsureNotificationAsync(userId, NotificationType.BudgetWarning, $"{budgetLabel} budget at 80%", $"Your {budget.Category?.Name} budget is already at {percent}% this month.", cancellationToken);
            }
        }

        var upcomingRecurring = await dbContext.RecurringTransactions.Where(x => x.UserId == userId && !x.IsPaused && x.NextRunDate.Date <= now.Date.AddDays(3)).ToListAsync(cancellationToken);
        foreach (var recurring in upcomingRecurring)
        {
            await EnsureNotificationAsync(userId, NotificationType.RecurringUpcoming, $"Upcoming {recurring.Title}", $"{recurring.Title} is due on {recurring.NextRunDate:dd MMM yyyy}.", cancellationToken);
        }

        var completedGoals = await dbContext.Goals.Where(x => x.UserId == userId && x.Status == GoalStatus.Completed).ToListAsync(cancellationToken);
        foreach (var goal in completedGoals)
        {
            await EnsureNotificationAsync(userId, NotificationType.GoalReached, $"Goal reached: {goal.Name}", $"You have completed your goal \"{goal.Name}\".", cancellationToken);
        }
    }

    private async Task EnsureNotificationAsync(Guid userId, NotificationType type, string title, string body, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Notifications.AnyAsync(x => x.UserId == userId && x.Type == type && x.Title == title && x.CreatedAt >= UtcDateTime.StartOfDayUtc(DateTime.UtcNow), cancellationToken);
        if (!exists)
        {
            await CreateAsync(userId, type, title, body, null, true, cancellationToken);
        }
    }
}

public interface IAccountAccessService
{
    Task<IReadOnlyCollection<Guid>> GetAccessibleAccountIdsAsync(Guid userId, CancellationToken cancellationToken);
    Task<SharedRole?> GetRoleAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);
    Task<bool> CanEditAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);
    Task<bool> CanOwnAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);
}

public sealed class AccountAccessService(AppDbContext dbContext) : IAccountAccessService
{
    public async Task<IReadOnlyCollection<Guid>> GetAccessibleAccountIdsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var owned = await dbContext.Accounts.Where(x => x.UserId == userId).Select(x => x.Id).ToListAsync(cancellationToken);
        var shared = await dbContext.AccountMembers.Where(x => x.UserId == userId).Select(x => x.AccountId).ToListAsync(cancellationToken);
        return owned.Concat(shared).Distinct().ToList();
    }

    public async Task<SharedRole?> GetRoleAsync(Guid userId, Guid accountId, CancellationToken cancellationToken)
    {
        var account = await dbContext.Accounts.FirstOrDefaultAsync(x => x.Id == accountId, cancellationToken);
        if (account?.UserId == userId)
        {
            return SharedRole.Owner;
        }

        return await dbContext.AccountMembers.Where(x => x.AccountId == accountId && x.UserId == userId).Select(x => (SharedRole?)x.Role).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<bool> CanEditAsync(Guid userId, Guid accountId, CancellationToken cancellationToken)
    {
        var role = await GetRoleAsync(userId, accountId, cancellationToken);
        return role is SharedRole.Owner or SharedRole.Editor;
    }

    public async Task<bool> CanOwnAsync(Guid userId, Guid accountId, CancellationToken cancellationToken)
    {
        var role = await GetRoleAsync(userId, accountId, cancellationToken);
        return role is SharedRole.Owner;
    }
}

public interface IAuditService
{
    Task LogAsync(Guid userId, string entityType, Guid entityId, string action, object? metadata, CancellationToken cancellationToken);
}

public sealed class AuditService(AppDbContext dbContext) : IAuditService
{
    public async Task LogAsync(Guid userId, string entityType, Guid entityId, string action, object? metadata, CancellationToken cancellationToken)
    {
        dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            MetadataJson = metadata is null ? "{}" : JsonSerializer.Serialize(metadata)
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

public interface IPdfExportService
{
    byte[] BuildReportPdf(string title, ReportResponse report, string appName);
}

public sealed class PdfExportService : IPdfExportService
{
    public byte[] BuildReportPdf(string title, ReportResponse report, string appName)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(28);
                page.Header().Column(column =>
                {
                    column.Item().Text(appName).FontSize(24).Bold().FontColor(Colors.Blue.Darken2);
                    column.Item().Text(title).FontSize(18).SemiBold();
                    column.Item().Text($"Generated on {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC").FontColor(Colors.Grey.Darken1);
                });

                page.Content().Column(column =>
                {
                    column.Spacing(12);
                    column.Item().Text("Monthly Trend").FontSize(14).Bold();
                    foreach (var point in report.MonthlyTrend.Take(12))
                    {
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Text(point.Label);
                            row.RelativeItem().AlignRight().Text($"Income {point.Income:n0}");
                            row.RelativeItem().AlignRight().Text($"Expense {point.Expense:n0}");
                            row.RelativeItem().AlignRight().Text($"Net {point.Balance:n0}");
                        });
                    }

                    column.Item().PaddingTop(12).Text("Top Categories").FontSize(14).Bold();
                    foreach (var item in report.CategoryBreakdown.Take(8))
                    {
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Text(item.Category);
                            row.RelativeItem().AlignRight().Text(item.Amount.ToString("n0"));
                        });
                    }

                    column.Item().PaddingTop(12).Text("Savings Goals").FontSize(14).Bold();
                    foreach (var goal in report.SavingsProgress.Take(8))
                    {
                        column.Item().Text($"{goal.Goal}: {goal.CurrentAmount:n0} / {goal.TargetAmount:n0} ({goal.ProgressPercent:n0}%)");
                    }
                });

                page.Footer().AlignCenter().Text($"{appName} branded report").FontColor(Colors.Grey.Medium);
            });
        }).GeneratePdf();
    }
}



