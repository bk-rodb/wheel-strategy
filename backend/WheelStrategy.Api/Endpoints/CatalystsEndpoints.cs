using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Endpoints;

public static class CatalystsEndpoints
{
    public static IEndpointRouteBuilder MapCatalystsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/catalysts", async (
            ICatalystsService catalysts,
            string? symbol,
            CancellationToken ct) =>
        {
            var sym = string.IsNullOrWhiteSpace(symbol) ? "NVDA" : symbol.Trim();
            try
            {
                var result = await catalysts.GetCatalystsAsync(sym, ct);
                return Results.Ok(result);
            }
            catch (HttpRequestException ex)
            {
                return Results.Problem(
                    title: "Upstream calendar request failed",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status502BadGateway);
            }
        })
        .WithName("GetCatalysts")
        .Produces<TickerCatalystsResult>(StatusCodes.Status200OK);

        return app;
    }
}
