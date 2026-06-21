using Microsoft.Extensions.Options;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Endpoints;

public static class WheelAnalysisEndpoints
{
    public static IEndpointRouteBuilder MapWheelAnalysisEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/analysis/wheel", async (
            IWheelAnalysisService analysis,
            IOptions<AnalysisOptions> opts,
            string? symbol,
            int? lookbackDays,
            int? dte,
            string? granularity,
            double? riskFreeRate,
            bool? refresh,
            CancellationToken ct) =>
        {
            var o = opts.Value;
            var req = new AnalysisRequest(
                Symbol: string.IsNullOrWhiteSpace(symbol) ? "NVDA" : symbol.Trim(),
                LookbackDays: lookbackDays is > 0 ? lookbackDays.Value : o.DefaultLookbackDays,
                Dte: dte is > 0 ? dte.Value : o.DefaultDte,
                Granularity: string.IsNullOrWhiteSpace(granularity) ? "weekly" : granularity.Trim(),
                RiskFreeRate: riskFreeRate,
                Refresh: refresh ?? false);

            try
            {
                var result = await analysis.AnalyzeAsync(req, ct);
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
        .WithName("GetWheelAnalysis")
        .Produces<WheelAnalysisResult>(StatusCodes.Status200OK);

        return app;
    }
}
