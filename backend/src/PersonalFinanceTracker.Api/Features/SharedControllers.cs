using Microsoft.AspNetCore.Authorization;
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
[Route("api/accounts")]
public sealed class SharedAccountsController(AppDbContext dbContext, ICurrentUserService currentUserService, IAccountAccessService accessService, INotificationService notificationService, IAuditService auditService) : ControllerBase
{
    [HttpPost("{id:guid}/invite")]
    public async Task<ActionResult<AccountInvitationDto>> Invite(Guid id, [FromBody] AccountInvitationRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        if (!await accessService.CanOwnAsync(userId, id, cancellationToken)) return Forbid();

        var invitation = new AccountInvitation
        {
            AccountId = id,
            Email = request.Email.Trim().ToLowerInvariant(),
            Role = request.Role,
            InviteToken = Convert.ToHexString(Guid.NewGuid().ToByteArray()) + Convert.ToHexString(Guid.NewGuid().ToByteArray()),
            Status = "Pending",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            InvitedByUserId = userId
        };

        dbContext.AccountInvitations.Add(invitation);
        await dbContext.SaveChangesAsync(cancellationToken);
        await notificationService.CreateAsync(userId, NotificationType.SharedInvitation, "Invitation sent", $"Invitation sent to {invitation.Email}.", new { invitation.AccountId, invitation.Role }, true, cancellationToken);
        await auditService.LogAsync(userId, "account_invitation", invitation.Id, "created", new { invitation.Email, invitation.Role }, cancellationToken);
        return Ok(new AccountInvitationDto(invitation.Id, invitation.AccountId, invitation.Email, invitation.Role, invitation.Status, invitation.ExpiresAt));
    }

    [HttpPost("invitations/accept/{token}")]
    public async Task<IActionResult> AcceptInvitation(string token, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var invitation = await dbContext.AccountInvitations.FirstOrDefaultAsync(x => x.InviteToken == token && x.Status == "Pending", cancellationToken);
        if (invitation is null || invitation.ExpiresAt < DateTime.UtcNow) return NotFound();

        var user = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
        if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase)) return BadRequest("Invitation email does not match the current user.");

        if (!await dbContext.AccountMembers.AnyAsync(x => x.AccountId == invitation.AccountId && x.UserId == userId, cancellationToken))
        {
            dbContext.AccountMembers.Add(new AccountMember { AccountId = invitation.AccountId, UserId = userId, InvitedByUserId = invitation.InvitedByUserId, Role = invitation.Role });
        }
        invitation.Status = "Accepted";
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(userId, "account_invitation", invitation.Id, "accepted", null, cancellationToken);
        return Ok();
    }

    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<AccountMemberDto>>> Members(Guid id, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var role = await accessService.GetRoleAsync(userId, id, cancellationToken);
        if (role is null) return Forbid();

        var account = await dbContext.Accounts.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (account is null) return NotFound();

        var members = await dbContext.AccountMembers.Include(x => x.User).Where(x => x.AccountId == id).ToListAsync(cancellationToken);
        var result = new List<AccountMemberDto>
        {
            new(account.UserId, account.User?.Email ?? string.Empty, account.User?.DisplayName ?? "Owner", SharedRole.Owner, "full access")
        };
        result.AddRange(members.Select(x => new AccountMemberDto(x.UserId, x.User?.Email ?? string.Empty, x.User?.DisplayName ?? string.Empty, x.Role, DescribePermissions(x.Role))));
        return Ok(result);
    }

    [HttpPut("{id:guid}/members/{memberUserId:guid}")]
    public async Task<IActionResult> UpdateMember(Guid id, Guid memberUserId, [FromBody] UpdateAccountMemberRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        if (!await accessService.CanOwnAsync(userId, id, cancellationToken)) return Forbid();
        var member = await dbContext.AccountMembers.FirstOrDefaultAsync(x => x.AccountId == id && x.UserId == memberUserId, cancellationToken);
        if (member is null) return NotFound();
        member.Role = request.Role;
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(userId, "account_member", member.Id, "updated", new { request.Role }, cancellationToken);
        return Ok();
    }

    [HttpPost("{id:guid}/request-edit")]
    public async Task<IActionResult> RequestEdit(Guid id, [FromBody] RequestEditAccessRequest request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.GetUserId();
        var role = await accessService.GetRoleAsync(userId, id, cancellationToken);
        if (role is not SharedRole.Viewer) return BadRequest("Only viewers can request edit access.");

        var requester = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
        var account = await dbContext.Accounts.FirstAsync(x => x.Id == id, cancellationToken);
        await notificationService.CreateAsync(account.UserId, NotificationType.SharedEditRequest, "Viewer requested edit access", $"{requester.DisplayName} requested editor access for {account.Name}. {request.Message}", new { account.Id, requester.Email }, true, cancellationToken);
        await auditService.LogAsync(userId, "account", account.Id, "edit_requested", new { request.Message }, cancellationToken);
        return Ok();
    }

    private static string DescribePermissions(SharedRole role)
        => role switch
        {
            SharedRole.Owner => "full access",
            SharedRole.Editor => "edit access",
            SharedRole.Viewer => "view and request edit",
            _ => string.Empty
        };
}
