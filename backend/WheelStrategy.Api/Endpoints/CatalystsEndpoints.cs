using System.Text.Json;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Endpoints;

public static class CatalystsEndpoints
{
    public static IEndpointRouteBuilder MapCatalystsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/catalysts", async (
            ICatalystsService catalysts,
            ILoggerFactory logFactory,
            string? symbol,
            CancellationToken ct) =>
        {
            var log = logFactory.CreateLogger("WheelStrategy.Api.Endpoints.Catalysts");

            if (!AnalysisQuery.TryNormalizeSymbol(symbol, out var sym, out var symbolError))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["symbol"] = [symbolError!],
                });
            }

            try
            {
                var result = await catalysts.GetCatalystsAsync(sym, ct);
                return Results.Ok(result);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (TaskCanceledException ex)
            {
                log.LogWarning(ex, "Catalysts request timed out for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream calendar request timed out",
                    detail: "The calendar provider did not respond in time.",
                    statusCode: StatusCodes.Status504GatewayTimeout);
            }
            catch (HttpRequestException ex)
            {
                log.LogWarning(ex, "Catalysts upstream failure for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream calendar request failed",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status502BadGateway);
            }
            catch (JsonException ex)
            {
                log.LogWarning(ex, "Catalysts JSON failure for {Symbol}", sym);
                return Results.Problem(
                    title: "Upstream calendar response was invalid",
                    detail: "The calendar provider returned a response that could not be parsed.",
                    statusCode: StatusCodes.Status502BadGateway);
            }
        })
        .WithName("GetCatalysts")
        .Produces<TickerCatalystsResult>(StatusCodes.Status200OK)
        .ProducesValidationProblem()
        .ProducesProblem(StatusCodes.Status502BadGateway)
        .ProducesProblem(StatusCodes.Status504GatewayTimeout);

        return app;
    }
}
