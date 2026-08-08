using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using System.Text.Json.Serialization;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Endpoints;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Orders;
using WheelStrategy.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Options
builder.Services.Configure<AlpacaOptions>(builder.Configuration.GetSection(AlpacaOptions.SectionName));
builder.Services.Configure<AnalysisOptions>(builder.Configuration.GetSection(AnalysisOptions.SectionName));
builder.Services.Configure<FinnhubOptions>(builder.Configuration.GetSection(FinnhubOptions.SectionName));
builder.Services.Configure<AlpacaProxyOptions>(builder.Configuration.GetSection(AlpacaProxyOptions.SectionName));

// Database (SQLite for the runnable default)
var conn = builder.Configuration.GetConnectionString("Default") ?? "Data Source=wheel.db";
builder.Services.AddDbContext<WheelStrategyDbContext>(o => o.UseSqlite(conn));

// RFC 7807 problem details for unhandled exceptions and status-code pages (H-20).
builder.Services.AddProblemDetails();

// Alpaca typed client + analysis services — explicit timeouts (H-20).
builder.Services.AddHttpClient<AlpacaMarketDataClient>((_, http) =>
{
    http.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<IBarCacheService, BarCacheService>();
builder.Services.AddScoped<IWheelAnalysisService, WheelAnalysisService>();
builder.Services.AddScoped<IHmmTrendService, HmmTrendService>();
builder.Services.AddScoped<IOrderJournalService, OrderJournalService>();

// Finnhub: token on X-Finnhub-Token so IHttpClientFactory never logs it in the URI (H-20).
builder.Services.AddHttpClient<ICatalystsService, CatalystsService>((sp, http) =>
{
    var opts = sp.GetRequiredService<IOptions<FinnhubOptions>>().Value;
    var baseUrl = string.IsNullOrWhiteSpace(opts.BaseUrl)
        ? "https://finnhub.io/api/v1"
        : opts.BaseUrl.TrimEnd('/');
    http.BaseAddress = new Uri(baseUrl + "/");
    http.Timeout = TimeSpan.FromSeconds(15);
    if (!string.IsNullOrWhiteSpace(opts.ApiKey))
        http.DefaultRequestHeaders.TryAddWithoutValidation("X-Finnhub-Token", opts.ApiKey);
});

// Outbound client for the browser-facing Alpaca proxy. Its own timeout so a hung
// Alpaca connection surfaces as a 504 instead of pinning the request forever.
builder.Services.AddHttpClient(AlpacaProxyEndpoints.HttpClientName, (sp, http) =>
{
    var proxyOpts = sp.GetRequiredService<IOptions<AlpacaProxyOptions>>().Value;
    http.Timeout = TimeSpan.FromSeconds(Math.Clamp(proxyOpts.TimeoutSeconds, 1, 120));
});

// Serialize enums as strings (matches the frontend's "safe"/"regular"/"risky")
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// OpenAPI — the analysis contract is the single source of truth for the TS types
// (generated via `npm run gen:api`). Document is emitted to WheelStrategy.Api.json at build.
builder.Services.AddOpenApi(options =>
{
    // .NET 10 emits numeric/integer schemas as a ["number"|"integer", "string"] union
    // with a validation pattern (it tolerates string-encoded numbers). Our JSON wire
    // format always sends real numbers, so collapse to the numeric type alone — this
    // keeps the generated TS fields `number` rather than `number | string`.
    options.AddSchemaTransformer((schema, _, _) =>
    {
        if (schema.Type is { } type && type.HasFlag(JsonSchemaType.String) &&
            (type.HasFlag(JsonSchemaType.Number) || type.HasFlag(JsonSchemaType.Integer)))
        {
            schema.Type = type & ~JsonSchemaType.String;
            schema.Pattern = null;
        }
        return Task.CompletedTask;
    });
});

// CORS for the Vite dev origin(s). POST/DELETE are needed because the browser now
// places and cancels orders through the Alpaca proxy rather than calling Alpaca
// directly; origins stay explicitly allowlisted.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173" };
const string CorsPolicy = "frontend";
builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p =>
    p.WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .WithMethods("GET", "POST", "DELETE")
        .WithExposedHeaders("Retry-After")));

var app = builder.Build();

// Apply EF migrations. An EnsureCreated-era wheel.db has tables but no
// __EFMigrationsHistory — drop the disposable bar cache and recreate (L-33).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WheelStrategyDbContext>();
    var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
        .CreateLogger("WheelStrategy.Api.Startup");
    try
    {
        var applied = db.Database.GetAppliedMigrations().Any();
        var pending = db.Database.GetPendingMigrations().Any();
        if (!applied && pending && db.Database.CanConnect())
        {
            // Likely EnsureCreated schema without migration history.
            log.LogWarning(
                "SQLite bar cache has no migration history; recreating wheel.db from migrations.");
            db.Database.EnsureDeleted();
        }
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Failed to apply EF migrations; recreating local bar cache once.");
        db.Database.EnsureDeleted();
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

// HTTPS redirection when an HTTPS port is configured (launch profile / reverse proxy).
app.UseHttpsRedirection();

app.UseCors(CorsPolicy);

// OpenAPI document browsing is Development-only; build-time emission is unchanged (L-32).
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapWheelAnalysisEndpoints();
app.MapHmmTrendEndpoints();
app.MapCatalystsEndpoints();
app.MapOrderJournalEndpoints();
app.MapAlpacaProxyEndpoints();

app.Run();
