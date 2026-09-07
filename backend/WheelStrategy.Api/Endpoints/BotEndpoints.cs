using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Endpoints;

public static class BotEndpoints
{
    public static IEndpointRouteBuilder MapBotEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/bot/config", async (IBotConfigService bot, CancellationToken ct) =>
            Results.Ok(await bot.GetConfigAsync(ct)))
            .WithName("GetBotConfig")
            .WithTags("Bot")
            .Produces<BotConfigResponse>();

        app.MapPost("/api/bot/config", async (
            UpdateBotSettingsRequest body,
            IBotConfigService bot,
            CancellationToken ct) =>
        {
            var (ok, config, error) = await bot.UpdateSettingsAsync(body, ct);
            return ok
                ? Results.Ok(config)
                : Results.Problem(
                    title: "Bot config rejected",
                    detail: error ?? "Invalid settings.",
                    statusCode: StatusCodes.Status400BadRequest);
        })
            .WithName("UpdateBotConfig")
            .WithTags("Bot")
            .Produces<BotConfigResponse>()
            .ProducesProblem(400);

        app.MapGet("/api/bot/runs", async (
            IBotConfigService bot,
            string? symbol,
            string? status,
            int? limit,
            CancellationToken ct) =>
        {
            var rows = await bot.ListRunsAsync(symbol, status, limit ?? 100, ct);
            return Results.Ok(new BotRunListResponse(rows));
        })
            .WithName("ListBotRuns")
            .WithTags("Bot")
            .Produces<BotRunListResponse>();

        app.MapPost("/api/bot/runs", async (
            CreateBotRunRequest body,
            IBotConfigService bot,
            CancellationToken ct) =>
        {
            var (ok, run, error) = await bot.AppendRunAsync(body, ct);
            return ok
                ? Results.Ok(run)
                : Results.Problem(
                    title: "Bot run rejected",
                    detail: error ?? "Invalid run.",
                    statusCode: StatusCodes.Status400BadRequest);
        })
            .WithName("AppendBotRun")
            .WithTags("Bot")
            .Produces<BotRunDto>()
            .ProducesProblem(400);

        app.MapPost("/api/bot/last-cycle", async (
            UpsertBotLastCycleRequest body,
            IBotConfigService bot,
            CancellationToken ct) =>
        {
            var (ok, cycle, error) = await bot.UpsertLastCycleAsync(body, ct);
            return ok
                ? Results.Ok(cycle)
                : Results.Problem(
                    title: "Last-cycle rejected",
                    detail: error ?? "Invalid last-cycle.",
                    statusCode: StatusCodes.Status400BadRequest);
        })
            .WithName("UpsertBotLastCycle")
            .WithTags("Bot")
            .Produces<BotLastCycleDto>()
            .ProducesProblem(400);

        app.MapDelete("/api/bot/last-cycle", async (
            IBotConfigService bot,
            string? symbol,
            CancellationToken ct) =>
        {
            var cleared = await bot.ClearLastCycleAsync(symbol, ct);
            return Results.Ok(new { cleared });
        })
            .WithName("ClearBotLastCycle")
            .WithTags("Bot");

        return app;
    }
}
