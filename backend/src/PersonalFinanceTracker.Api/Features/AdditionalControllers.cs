using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PersonalFinanceTracker.Api.Common;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Domain.Enums;
using PersonalFinanceTracker.Api.Persistence;
using PersonalFinanceTracker.Api.Services;

namespace PersonalFinanceTracker.Api.Features;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public sealed class AuthRecoveryController(IAuthService authService, IOptions<AppBrandingOptions> brandingOptions) : ControllerBase
{
    private readonly AppBrandingOptions _branding = brandingOptions.Value;

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request, CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(request.RefreshToken, cancellationToken);
        return NoContent();
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await authService.ForgotPasswordAsync(request, cancellationToken);
            return Ok(new { message = $"If the email exists in {_branding.AppName}, a reset token has been sent." });
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, exception.Message);
        }
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await authService.ResetPasswordAsync(request, cancellationToken);
            return Ok(new { message = "Password reset successful." });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }
}

[ApiController]
[Authorize]
[Route("api/app")]
public sealed class AppInfoController(IOptions<AppBrandingOptions> brandingOptions) : ControllerBase
{
    [HttpGet("info")]
    public ActionResult<AppBrandingResponse> GetInfo()
    {
        var branding = brandingOptions.Value;
        return Ok(new AppBrandingResponse(branding.AppName, branding.DefaultCurrency, branding.DefaultLocale, branding.NotificationMode, branding.DeploymentTarget, branding.PdfExportStyle));
    }
}

[ApiController]
[Authorize]
[Route("api/profile")]
public sealed class ProfileController(AppDbContext dbContext, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<UserProfileDto>> Me(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null) return NotFound();

        return Ok(new UserProfileDto(
            user.DisplayName,
            user.Email,
            user.Headline,
            user.PhoneNumber,
            user.City,
            user.ProfileImageUrl));
    }

    [HttpPut("me")]
    public async Task<ActionResult<UserProfileDto>> UpdateMe([FromBody] UserProfileUpdateRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null) return NotFound();

        var displayName = request.DisplayName.Trim();
        if (displayName.Length < 2)
        {
            return BadRequest("Display name must be at least 2 characters.");
        }

        static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        user.DisplayName = displayName;
        user.Headline = Clean(request.Headline);
        user.PhoneNumber = Clean(request.PhoneNumber);
        user.City = Clean(request.City);
        user.ProfileImageUrl = Clean(request.ProfileImageUrl);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new UserProfileDto(
            user.DisplayName,
            user.Email,
            user.Headline,
            user.PhoneNumber,
            user.City,
            user.ProfileImageUrl));
    }
}

[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController(AppDbContext dbContext, ICurrentUserService currentUserService, INotificationService notificationService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        await notificationService.SyncFinancialAlertsAsync(userId, cancellationToken);
        var notifications = await dbContext.Notifications.Where(x => x.UserId == userId).OrderByDescending(x => x.CreatedAt)
            .Select(x => new NotificationDto(x.Id, x.Type, x.Title, x.Body, x.EmailSent, x.CreatedAt, x.ReadAt))
            .ToListAsync(cancellationToken);
        return Ok(notifications);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, [FromBody] MarkNotificationReadRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (notification is null) return NotFound();
        notification.ReadAt = request.Read ? DateTime.UtcNow : null;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }
}

[ApiController]
[Authorize]
[Route("api/reports")]
public sealed class ReportExportController(IAnalyticsService analyticsService, ICurrentUserService currentUserService, IPdfExportService pdfExportService, IOptions<AppBrandingOptions> brandingOptions) : ControllerBase
{
    [HttpGet("export/pdf")]
    public async Task<IActionResult> ExportPdf([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? accountId, [FromQuery] Guid? categoryId, [FromQuery] TransactionType? type, CancellationToken cancellationToken)
    {
        var report = await analyticsService.GetReportsAsync(currentUserService.GetUserId(), from, to, accountId, categoryId, type, cancellationToken);
        var branding = brandingOptions.Value;
        var bytes = pdfExportService.BuildReportPdf("CashKalesh Financial Report", report, branding.AppName);
        return File(bytes, "application/pdf", "cashkalesh-report.pdf");
    }

    [HttpGet("export/csv-branded")]
    public async Task<IActionResult> ExportCsv([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] Guid? accountId, [FromQuery] Guid? categoryId, [FromQuery] TransactionType? type, CancellationToken cancellationToken)
    {
        var report = await analyticsService.GetReportsAsync(currentUserService.GetUserId(), from, to, accountId, categoryId, type, cancellationToken);
        var builder = new StringBuilder();
        builder.AppendLine("label,income,expense,balance,savingsRate");
        foreach (var point in report.MonthlyTrend)
        {
            var savingsRate = point.Income == 0 ? 0 : decimal.Round((point.Balance / point.Income) * 100m, 1);
            builder.AppendLine($"{point.Label},{point.Income},{point.Expense},{point.Balance},{savingsRate}");
        }
        return File(Encoding.UTF8.GetBytes(builder.ToString()), "text/csv", "cashkalesh-report.csv");
    }
}



