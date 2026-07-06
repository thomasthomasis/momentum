using System.Net;
using System.Text.Json;
using Momentum.Api.Services;
using ValidationException = Momentum.Api.Services.ValidationException;

namespace Momentum.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch(Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (status, title) = ex switch
        {
            KeyNotFoundException        => (StatusCodes.Status404NotFound,            "Not Found"),
            ConflictException           => (StatusCodes.Status409Conflict,             "Conflict"),
            ValidationException         => (StatusCodes.Status422UnprocessableEntity,  "Validation Error"),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized,         "Unauthorized"),
            _                           => (StatusCodes.Status500InternalServerError,  "Internal Server Error")
        };

        if (status >= 500)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
        }
        else
        {
            _logger.LogDebug(ex, "Domain exception: {Message}", ex.Message);
        }

        // Domain exceptions (404/409/422/401) carry deliberately user-facing
        // messages — safe to return as-is. An unhandled 500 could be anything
        // (EF Core internals, a library's exception text, etc.), so it always
        // gets a generic message regardless of environment; the real ex.Message
        // is still captured above via the logger.
        var detail = status >= 500 ? "An unexpected error occurred." : ex.Message;

        var problem = new
        {
            type   = $"https://httpstatuses.com/{status}",
            title,
            status,
            detail,
            trace  = _env.IsDevelopment() ? ex.StackTrace : null
        };

        context.Response.StatusCode  = status;
        context.Response.ContentType = "application/problem+json";

        await context.Response.WriteAsync(
            JsonSerializer.Serialize(problem, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            })
        );
    }
}