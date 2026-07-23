using Microsoft.Extensions.Options;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Endpoints;

public static class HmmTrendEndpoints
{
    public static IEndpointRouteBuilder MapHmmTrendEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/analysis/hmm", async (
            IHmmTrendService hmm,
            IOptions<AnalysisOptions> opts,
            string? symbol,
            int? lookbackDays,
            string? granularity,
            bool? refresh,
            CancellationToken ct) =>
        {
            var o = opts.Value;
            var req = new HmmTrendRequest(
                Symbol: string.IsNullOrWhiteSpace(symbol) ? "NVDA" : symbol.Trim(),
                LookbackDays: lookbackDays is > 0 ? lookbackDays.Value : o.DefaultLookbackDays,
                Granularity: string.IsNullOrWhiteSpace(granularity) ? "weekly" : granularity.Trim(),
                Refresh: refresh ?? false);

            try
            {
                var result = await hmm.AnalyzeAsync(req, ct);
                return Results.Ok(result);
            }
            catch (HttpRequestException ex)
            {
                return Results.Problem(
                    title: "Upstream market-data request failed",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status502BadGateway);
            }
        })
        .WithName("GetHmmTrend")
        .Produces<HmmTrendResult>(StatusCodes.Status200OK);

        return app;
    }
}
