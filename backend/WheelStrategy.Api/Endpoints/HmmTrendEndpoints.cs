using System.Text.Json;
using Microsoft.EntityFrameworkCore;
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
            ILoggerFactory logFactory,
            string? symbol,
            int? lookbackDays,
            string? granularity,
            bool? refresh,
            CancellationToken ct) =>
        {
            var log = logFactory.CreateLogger("WheelStrategy.Api.Endpoints.HmmTrend");
            var o = opts.Value;

            if (!AnalysisQuery.TryNormalizeSymbol(symbol, out var sym, out var symbolError))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["symbol"] = [symbolError!],
                });
            }

            var req = new HmmTrendRequest(
                Symbol: sym,
                LookbackDays: AnalysisQuery.ResolveLookbackDays(
                    lookbackDays, o.DefaultLookbackDays, o.MaxLookbackDays),
                Granularity: AnalysisQuery.ResolveGranularity(granularity),
                Refresh: refresh ?? false);

            try
            {
                var result = await hmm.AnalyzeAsync(req, ct);
                return Results.Ok(result);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (TaskCanceledException ex)
            {
                log.LogWarning(ex, "HMM analysis timed out for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream market-data request timed out",
                    detail: "The market-data provider did not respond in time.",
                    statusCode: StatusCodes.Status504GatewayTimeout);
            }
            catch (HttpRequestException ex)
            {
                log.LogWarning(ex, "HMM analysis upstream failure for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream market-data request failed",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status502BadGateway);
            }
            catch (JsonException ex)
            {
                log.LogWarning(ex, "HMM analysis JSON failure for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream market-data response was invalid",
                    detail: "The market-data provider returned a response that could not be parsed.",
                    statusCode: StatusCodes.Status502BadGateway);
            }
            catch (DbUpdateException ex)
            {
                log.LogError(ex, "HMM analysis cache write failed for {Symbol}", sym);
                return Results.Problem(
                    title: "Bar cache update failed",
                    detail: "Could not update the local historical-bar cache.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        })
        .WithName("GetHmmTrend")
        .Produces<HmmTrendResult>(StatusCodes.Status200OK)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status502BadGateway)
        .ProducesProblem(StatusCodes.Status504GatewayTimeout);

        return app;
    }
}
