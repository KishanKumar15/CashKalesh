using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace PersonalFinanceTracker.Api.Services;

public sealed class GoogleAuthOptions
{
    public string ClientId { get; set; } = string.Empty;
}

public sealed record GoogleUserProfile(string Subject, string Email, string DisplayName, string? AvatarUrl);

public interface IGoogleTokenValidator
{
    Task<GoogleUserProfile?> ValidateAsync(string credential, CancellationToken cancellationToken);
}

public sealed class GoogleTokenValidator(IOptions<GoogleAuthOptions> options, ILogger<GoogleTokenValidator> logger) : IGoogleTokenValidator
{
    private readonly GoogleAuthOptions _options = options.Value;

    public async Task<GoogleUserProfile?> ValidateAsync(string credential, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId) || string.IsNullOrWhiteSpace(credential))
        {
            logger.LogWarning("Google sign-in attempted without a configured client id or credential.");
            return null;
        }

        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(
                credential,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { _options.ClientId }
                });

            if (string.IsNullOrWhiteSpace(payload.Email) || !payload.EmailVerified)
            {
                return null;
            }

            return new GoogleUserProfile(
                payload.Subject,
                payload.Email,
                string.IsNullOrWhiteSpace(payload.Name) ? payload.Email.Split('@')[0] : payload.Name,
                payload.Picture);
        }
        catch (InvalidJwtException exception)
        {
            logger.LogWarning(exception, "Google token validation failed.");
            return null;
        }
    }
}
