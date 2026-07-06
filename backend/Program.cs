using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Momentum.Api.Data;
using Momentum.Api.Entities;
using Momentum.Api.Middleware;
using Momentum.Api.Repositories;
using Momentum.Api.Services;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ─── Controllers ──────────────────────────────────────────────────────────────

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
        opts.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// ─── Database ─────────────────────────────────────────────────────────────────

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
        .UseSnakeCaseNamingConvention()
);

// ─── Identity ─────────────────────────────────────────────────────────────────
// AddIdentity registers UserManager, SignInManager, RoleManager and the
// EF Core stores that persist users/roles to the database.
// We turn off some defaults that would redirect to login pages
// (this is an API — we want 401, not 302).

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(opts =>
{
    opts.Password.RequireDigit             = true;
    opts.Password.RequiredLength           = 12;
    opts.Password.RequireUppercase         = true;
    opts.Password.RequireNonAlphanumeric   = true;
    opts.User.RequireUniqueEmail           = true;

    // Login goes through SignInManager.CheckPasswordSignInAsync (see AuthController),
    // which is what actually enforces these — UserManager.CheckPasswordAsync alone
    // does not touch lockout state.
    opts.Lockout.DefaultLockoutTimeSpan    = TimeSpan.FromMinutes(15);
    opts.Lockout.MaxFailedAccessAttempts   = 5;
    opts.Lockout.AllowedForNewUsers        = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// Stop Identity redirecting to /Account/Login on 401 — we want raw 401 JSON
builder.Services.ConfigureApplicationCookie(opts =>
{
    opts.Events.OnRedirectToLogin        = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    opts.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
});

// ─── JWT Authentication ────────────────────────────────────────────────────────
// AddAuthentication sets the default scheme so [Authorize] uses JWT.
// The JwtBearer handler validates the token on every request that hits a
// protected endpoint — it checks signature, issuer, audience, and expiry.

var jwtSecret  = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
var jwtIssuer   = builder.Configuration["Jwt:Issuer"]   ?? "momentum-api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "momentum-app";

// Fail closed rather than silently signing tokens with a well-known example
// value — this exact string lives in docker-compose.yml for local dev only.
const string ExampleJwtSecret = "your-super-secret-key-minimum-32-characters-long";
if (builder.Environment.IsProduction() && (jwtSecret == ExampleJwtSecret || jwtSecret.Length < 32))
{
    throw new InvalidOperationException(
        "Refusing to start in Production with a missing, too-short, or placeholder Jwt:Secret. " +
        "Set a real secret (32+ random bytes) via environment variable or secret manager.");
}

builder.Services.AddAuthentication(opts =>
{
    opts.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opts.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(opts =>
{
    opts.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer              = jwtIssuer,
        ValidAudience            = jwtAudience,
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew                = TimeSpan.FromSeconds(30),
    };
});

builder.Services.AddAuthorization();

// ─── Repositories & Services ──────────────────────────────────────────────────

builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<IFocusSessionRepository, FocusSessionRepository>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IFocusSessionService, FocusSessionService>();
builder.Services.AddSingleton<IPairingCodeStore, PairingCodeStore>();

// ─── Swagger ──────────────────────────────────────────────────────────────────

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Momentum API", Version = "v1" });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Enter your JWT access token.",
    };

    c.AddSecurityDefinition("Bearer", securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Cors:AllowedWebOrigin / Cors:AllowedExtensionId let production lock these
// down via config once real values exist, without a code change. Until the
// extension has a published ID, we fall back to accepting any
// chrome-extension:// origin (dev-only posture — see security audit).

var allowedWebOrigin   = builder.Configuration["Cors:AllowedWebOrigin"] ?? "http://localhost:5173";
var allowedExtensionId = builder.Configuration["Cors:AllowedExtensionId"];

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(policy =>
        policy.SetIsOriginAllowed(origin =>
                origin == allowedWebOrigin ||
                (allowedExtensionId is not null
                    ? origin == $"chrome-extension://{allowedExtensionId}"
                    : origin.StartsWith("chrome-extension://")))
              .AllowAnyHeader()
              .AllowAnyMethod()));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// "auth" is a strict per-IP limit on the anonymous auth endpoints — the primary
// defense against credential stuffing / brute force (lockout in AuthController
// handles the per-account side). Everything else gets a generous global limit
// as a coarse resource-exhaustion safety net.

builder.Services.AddRateLimiter(opts =>
{
    opts.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    opts.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window      = TimeSpan.FromMinutes(1),
                PermitLimit = 10,
                QueueLimit  = 0,
            }));

    opts.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window      = TimeSpan.FromMinutes(1),
                PermitLimit = 300,
                QueueLimit  = 0,
            }));
});

// ─── Pipeline ─────────────────────────────────────────────────────────────────

var app = builder.Build();

// Trust X-Forwarded-For/-Proto from the reverse proxy/load balancer in front of
// this container (e.g. an ALB) so UseHttpsRedirection/UseHsts and RemoteIpAddress
// (used by the rate limiter above) see the real client scheme/IP, not the
// proxy's. Clearing Known*Networks/Proxies assumes this app is only reachable
// through that trusted proxy, never directly from the internet — standard for
// a containerized deployment behind a cloud load balancer.
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedHeadersOptions.KnownNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // Auto-migrate in development so `docker compose up` is all you need
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors();

// Order matters: Authentication reads the JWT and populates HttpContext.User.
// Authorization then checks whether that user can access the endpoint.
// Swapping them means the user identity is never set when the check runs.
app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

app.MapControllers();

app.Run();