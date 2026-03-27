using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PersonalFinanceTracker.Api.Contracts;
using PersonalFinanceTracker.Api.Domain.Entities;
using PersonalFinanceTracker.Api.Persistence;

namespace PersonalFinanceTracker.Api.Services;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "CashKalesh";
    public string Audience { get; set; } = "CashKalesh.Frontend";
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 14;
}

public interface ICurrentUserService
{
    Guid GetUserId();
}

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor, AppDbContext dbContext) : ICurrentUserService
{
    public Guid GetUserId()
    {
        var context = httpContextAccessor.HttpContext;
        var claim = context?.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(claim, out var claimId))
        {
            return claimId;
        }

        var header = context?.Request.Headers["X-Demo-User"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(header))
        {
            var demoUser = dbContext.Users.FirstOrDefault(x => x.Email == header);
            if (demoUser is not null)
            {
                return demoUser.Id;
            }
        }

        return dbContext.Users.Select(x => x.Id).First();
    }
}

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);
    Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
    Task<AuthResponse?> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken cancellationToken);
    Task<AuthResponse?> RefreshAsync(string refreshToken, CancellationToken cancellationToken);
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken);
    Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken);
    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken);
}

public sealed class AuthService(
    AppDbContext dbContext,
    IOptions<JwtOptions> jwtOptions,
    IOptions<AppBrandingOptions> brandingOptions,
    IEmailService emailService,
    IAuditService auditService,
    IGoogleTokenValidator googleTokenValidator) : IAuthService
{
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;
    private readonly AppBrandingOptions _branding = brandingOptions.Value;

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        ValidatePassword(request.Password);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await dbContext.Users.AnyAsync(x => x.Email == normalizedEmail, cancellationToken))
        {
            throw new InvalidOperationException("Email is already registered.");
        }

        var user = new User
        {
            Email = normalizedEmail,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        dbContext.Users.Add(user);
        dbContext.UserPreferences.Add(new UserPreference { User = user, CurrencyCode = _branding.DefaultCurrency, Locale = _branding.DefaultLocale });
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(user.Id, "user", user.Id, "registered", new { user.Email }, cancellationToken);

        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
        if (user is null || string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            return null;
        }

        bool passwordMatches;
        try
        {
            passwordMatches = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        }
        catch
        {
            passwordMatches = false;
        }

        if (!passwordMatches)
        {
            return null;
        }

        await auditService.LogAsync(user.Id, "user", user.Id, "logged_in", null, cancellationToken);
        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task<AuthResponse?> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken cancellationToken)
    {
        var profile = await googleTokenValidator.ValidateAsync(request.Credential, cancellationToken);
        if (profile is null)
        {
            return null;
        }

        var normalizedEmail = profile.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
        if (user is null)
        {
            user = new User
            {
                Email = normalizedEmail,
                DisplayName = profile.DisplayName.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)))
            };

            dbContext.Users.Add(user);
            dbContext.UserPreferences.Add(new UserPreference { User = user, CurrencyCode = _branding.DefaultCurrency, Locale = _branding.DefaultLocale });
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditService.LogAsync(user.Id, "user", user.Id, "registered_google", new { user.Email, profile.Subject }, cancellationToken);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(user.DisplayName))
            {
                user.DisplayName = profile.DisplayName.Trim();
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            await auditService.LogAsync(user.Id, "user", user.Id, "logged_in_google", new { profile.Subject }, cancellationToken);
        }

        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task<AuthResponse?> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var tokenHash = Hash(refreshToken);
        var refreshRecord = await dbContext.RefreshTokens.Include(x => x.User)
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.RevokedAt == null, cancellationToken);

        if (refreshRecord is null || refreshRecord.ExpiresAt <= DateTime.UtcNow || refreshRecord.User is null)
        {
            return null;
        }

        refreshRecord.RevokedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return await IssueTokensAsync(refreshRecord.User, cancellationToken);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var tokenHash = Hash(refreshToken);
        var refreshRecord = await dbContext.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.RevokedAt == null, cancellationToken);
        if (refreshRecord is null)
        {
            return;
        }

        refreshRecord.RevokedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(refreshRecord.UserId, "refresh_token", refreshRecord.Id, "revoked", null, cancellationToken);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
        if (user is null)
        {
            return;
        }

        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        dbContext.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        var frontendBaseUrl = string.IsNullOrWhiteSpace(_branding.FrontendBaseUrl) ? "http://localhost:5173" : _branding.FrontendBaseUrl.TrimEnd('/');
        var resetLink = $"{frontendBaseUrl}/?token={Uri.EscapeDataString(rawToken)}";
        var html = $"""
                    <p>Hello {WebUtility.HtmlEncode(user.DisplayName)},</p>
                    <p>Use the link below to reset your {_branding.AppName} password:</p>
                    <p><a href="{WebUtility.HtmlEncode(resetLink)}">Reset password</a></p>
                    <p>If the button does not open, paste this link in your browser:</p>
                    <p>{WebUtility.HtmlEncode(resetLink)}</p>
                    <p>This link expires in 1 hour.</p>
                    """;
        await emailService.SendAsync(user.Email, $"{_branding.AppName} password reset", html, cancellationToken);
        await auditService.LogAsync(user.Id, "password_reset", user.Id, "requested", null, cancellationToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        ValidatePassword(request.Password);

        var tokenHash = Hash(request.Token);
        var resetToken = await dbContext.PasswordResetTokens.Include(x => x.User)
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.UsedAt == null, cancellationToken);

        if (resetToken?.User is null || resetToken.ExpiresAt <= DateTime.UtcNow)
        {
            throw new InvalidOperationException("Reset token is invalid or expired.");
        }

        resetToken.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        resetToken.UsedAt = DateTime.UtcNow;

        var userRefreshTokens = await dbContext.RefreshTokens.Where(x => x.UserId == resetToken.UserId && x.RevokedAt == null).ToListAsync(cancellationToken);
        foreach (var refreshToken in userRefreshTokens)
        {
            refreshToken.RevokedAt = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(resetToken.UserId, "password_reset", resetToken.Id, "completed", null, cancellationToken);
    }

    private async Task<AuthResponse> IssueTokensAsync(User user, CancellationToken cancellationToken)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim(ClaimTypes.Email, user.Email)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwtOptions.AccessTokenMinutes),
            signingCredentials: credentials);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var rawRefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = Hash(rawRefreshToken),
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenDays)
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return new AuthResponse(accessToken, rawRefreshToken, new UserSummary(user.Id, user.Email, user.DisplayName));
    }

    private static void ValidatePassword(string password)
    {
        if (password.Length < 8 || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit))
        {
            throw new InvalidOperationException("Password must be at least 8 characters and include uppercase, lowercase, and a number.");
        }
    }

    private static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes);
    }
}
