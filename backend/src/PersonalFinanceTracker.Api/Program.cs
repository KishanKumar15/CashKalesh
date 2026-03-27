using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using dotenv.net;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Npgsql;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PersonalFinanceTracker.Api.Common;
using PersonalFinanceTracker.Api.Persistence;
using PersonalFinanceTracker.Api.Services;
using Serilog;

DotEnv.Load(new DotEnvOptions(
    envFilePaths: new[]
    {
        Path.Combine(Directory.GetCurrentDirectory(), "backend", ".env"),
        Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env"),
        Path.Combine(Directory.GetCurrentDirectory(), ".env")
    },
    probeForEnv: false,
    overwriteExistingVars: false,
    ignoreExceptions: true));

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console();
});

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<AppBrandingOptions>(builder.Configuration.GetSection("Branding"));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<GoogleAuthOptions>(options =>
{
    builder.Configuration.GetSection("GoogleAuth").Bind(options);
    options.ClientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID")
        ?? Environment.GetEnvironmentVariable("GoogleAuth__ClientId")
        ?? options.ClientId;
});

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy => policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("DefaultConnection is required.");

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAccountBalanceService, AccountBalanceService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IRuleEngineService, RuleEngineService>();
builder.Services.AddScoped<IAppSeeder, AppSeeder>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IAccountAccessService, AccountAccessService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IPdfExportService, PdfExportService>();
builder.Services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
builder.Services.AddHostedService<RecurringTransactionWorker>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

await ApplyDatabaseStartupAsync(app.Services, builder.Configuration);

app.Run();

static async Task ApplyDatabaseStartupAsync(IServiceProvider services, IConfiguration configuration)
{
    const int maxAttempts = 10;
    var delay = TimeSpan.FromSeconds(2);

    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            using var scope = services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await dbContext.Database.MigrateAsync();

            if (configuration.GetValue<bool>("Seed:Enabled"))
            {
                var seeder = scope.ServiceProvider.GetRequiredService<IAppSeeder>();
                await seeder.SeedAsync(CancellationToken.None);
            }

            Log.Information("Database migrations and startup seed completed.");
            return;
        }
        catch (Exception exception) when (IsTransientDatabaseStartupError(exception) && attempt < maxAttempts)
        {
            Log.Warning(exception, "Database startup attempt {Attempt}/{MaxAttempts} failed. Retrying in {DelaySeconds}s.", attempt, maxAttempts, delay.TotalSeconds);
            await Task.Delay(delay);
            delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 1.5, 10));
        }
    }

    using var finalScope = services.CreateScope();
    var finalDbContext = finalScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await finalDbContext.Database.MigrateAsync();

    if (configuration.GetValue<bool>("Seed:Enabled"))
    {
        var seeder = finalScope.ServiceProvider.GetRequiredService<IAppSeeder>();
        await seeder.SeedAsync(CancellationToken.None);
    }
}

static bool IsTransientDatabaseStartupError(Exception exception)
{
    if (exception is NpgsqlException or TimeoutException)
    {
        return true;
    }

    return exception.InnerException is not null && IsTransientDatabaseStartupError(exception.InnerException);
}



