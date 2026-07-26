using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using System.Text.Json.Serialization;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Endpoints;
using WheelStrategy.Api.Options;
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

// Alpaca typed client + analysis services
builder.Services.AddHttpClient<AlpacaMarketDataClient>();
builder.Services.AddScoped<IBarCacheService, BarCacheService>();
builder.Services.AddScoped<IWheelAnalysisService, WheelAnalysisService>();
builder.Services.AddScoped<IHmmTrendService, HmmTrendService>();
builder.Services.AddHttpClient<ICatalystsService, CatalystsService>();

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

// Create the DB schema if it doesn't exist (no migrations in this increment).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WheelStrategyDbContext>();
    db.Database.EnsureCreated();
}

app.UseCors(CorsPolicy);

app.MapOpenApi();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapWheelAnalysisEndpoints();
app.MapHmmTrendEndpoints();
app.MapCatalystsEndpoints();
app.MapAlpacaProxyEndpoints();

app.Run();
