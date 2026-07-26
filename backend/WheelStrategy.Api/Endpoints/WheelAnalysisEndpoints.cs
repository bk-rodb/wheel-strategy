using System.Text.Json;
using Microsoft.EntityFrameworkCore;
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
            ILoggerFactory logFactory,
            string? symbol,
            int? lookbackDays,
            int? dte,
            string? granularity,
            double? riskFreeRate,
            bool? refresh,
            CancellationToken ct) =>
        {
            var log = logFactory.CreateLogger("WheelStrategy.Api.Endpoints.WheelAnalysis");
            var o = opts.Value;

            if (!AnalysisQuery.TryNormalizeSymbol(symbol, out var sym, out var symbolError))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["symbol"] = [symbolError!],
                });
            }

            var req = new AnalysisRequest(
                Symbol: sym,
                LookbackDays: AnalysisQuery.ResolveLookbackDays(
                    lookbackDays, o.DefaultLookbackDays, o.MaxLookbackDays),
                Dte: AnalysisQuery.ResolveDte(dte, o.DefaultDte, o.MaxDte),
                Granularity: AnalysisQuery.ResolveGranularity(granularity),
                RiskFreeRate: riskFreeRate,
                Refresh: refresh ?? false);

            try
            {
                var result = await analysis.AnalyzeAsync(req, ct);
                return Results.Ok(result);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (TaskCanceledException ex)
            {
                log.LogWarning(ex, "Wheel analysis timed out for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream market-data request timed out",
                    detail: "The market-data provider did not respond in time.",
                    statusCode: StatusCodes.Status504GatewayTimeout);
            }
            catch (HttpRequestException ex)
            {
                log.LogWarning(ex, "Wheel analysis upstream failure for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream market-data request failed",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status502BadGateway);
            }
            catch (JsonException ex)
            {
                log.LogWarning(ex, "Wheel analysis JSON failure for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream market-data response was invalid",
                    detail: "The market-data provider returned a response that could not be parsed.",
                    statusCode: StatusCodes.Status502BadGateway);
            }
            catch (DbUpdateException ex)
            {
                log.LogError(ex, "Wheel analysis cache write failed for {Symbol}", sym);
                return Results.Problem(
                    title: "Bar cache update failed",
                    detail: "Could not update the local historical-bar cache.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        })
        .WithName("GetWheelAnalysis")
        .Produces<WheelAnalysisResult>(StatusCodes.Status200OK)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status502BadGateway)
        .ProducesProblem(StatusCodes.Status504GatewayTimeout);

        return app;
    }
}
