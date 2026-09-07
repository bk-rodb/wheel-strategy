using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Tests;

public class BotConfigServiceTests
{
    private static WheelStrategyDbContext CreateDb()
    {
        var conn = new SqliteConnection("Data Source=:memory:");
        conn.Open();
        var opts = new DbContextOptionsBuilder<WheelStrategyDbContext>()
            .UseSqlite(conn)
            .Options;
        var db = new WheelStrategyDbContext(opts);
        db.Database.EnsureCreated();
        return db;
    }

    [Fact]
    public async Task GetConfig_SeedsDefaults()
    {
        await using var db = CreateDb();
        var svc = new BotConfigService(db);

        var config = await svc.GetConfigAsync();

        Assert.Equal(BotConfigService.DefaultSymbols, config.Settings.Symbols);
        Assert.Equal("regular", config.Settings.Level);
        Assert.True(config.Settings.DryRun);
        Assert.False(config.Settings.Paused);
        Assert.Empty(config.LastCycles);
    }

    [Fact]
    public async Task UpdateSettings_RejectsEmptyAndBadSymbols()
    {
        await using var db = CreateDb();
        var svc = new BotConfigService(db);

        var empty = await svc.UpdateSettingsAsync(new UpdateBotSettingsRequest([], null, null, null));
        Assert.False(empty.Ok);
        Assert.Contains("At least one", empty.Error);

        var bad = await svc.UpdateSettingsAsync(
            new UpdateBotSettingsRequest(["nvda!"], null, null, null));
        Assert.False(bad.Ok);
        Assert.Contains("Invalid symbol", bad.Error);

        var badLevel = await svc.UpdateSettingsAsync(
            new UpdateBotSettingsRequest(null, "aggressive", null, null));
        Assert.False(badLevel.Ok);
        Assert.Contains("Level", badLevel.Error);
    }

    [Fact]
    public async Task UpdateSettings_DedupesAndPersists()
    {
        await using var db = CreateDb();
        var svc = new BotConfigService(db);

        var (ok, config, err) = await svc.UpdateSettingsAsync(
            new UpdateBotSettingsRequest(["nvda", "NVDA", "rklb"], "SAFE", false, true));
        Assert.True(ok, err);
        Assert.Equal(["NVDA", "RKLB"], config!.Settings.Symbols);
        Assert.Equal("safe", config.Settings.Level);
        Assert.False(config.Settings.DryRun);
        Assert.True(config.Settings.Paused);
    }

    [Fact]
    public async Task AppendRun_AndList_FiltersBySymbol()
    {
        await using var db = CreateDb();
        var svc = new BotConfigService(db);
        var at = new DateTimeOffset(2026, 9, 7, 13, 35, 0, TimeSpan.Zero);

        var a = await svc.AppendRunAsync(new CreateBotRunRequest(
            at, "NVDA", "2026-09-11", "put", 1, true, "dry_run",
            "ticket", "NVDA260911P00150000", 150, 1.25, null, "cid-1", null, ["wide"]));
        Assert.True(a.Ok, a.Error);

        await svc.AppendRunAsync(new CreateBotRunRequest(
            at.AddMinutes(1), "RKLB", "2026-09-11", "call", 1, false, "blocked",
            "Pre-trade", null, null, null, null, null, ["need shares"], null));

        var nvda = await svc.ListRunsAsync("nvda", null, 50);
        Assert.Single(nvda);
        Assert.Equal("NVDA", nvda[0].Symbol);
        Assert.Equal("dry_run", nvda[0].Status);
        Assert.Equal(["wide"], nvda[0].Warnings);

        var blocked = await svc.ListRunsAsync(null, "blocked", 50);
        Assert.Single(blocked);
        Assert.Equal("RKLB", blocked[0].Symbol);
    }

    [Fact]
    public async Task AppendRun_RejectsBadStatus_AllowsStarSymbol()
    {
        await using var db = CreateDb();
        var svc = new BotConfigService(db);
        var at = DateTimeOffset.UtcNow;

        var bad = await svc.AppendRunAsync(new CreateBotRunRequest(
            at, "NVDA", "2026-09-11", "?", 0, true, "nope", null, null, null, null, null, null, null, null));
        Assert.False(bad.Ok);

        var paused = await svc.AppendRunAsync(new CreateBotRunRequest(
            at, "*", "2026-09-11", "?", 0, true, "skipped", "paused", null, null, null, null, null, null, null));
        Assert.True(paused.Ok, paused.Error);
        Assert.Equal("*", paused.Run!.Symbol);
    }

    [Fact]
    public async Task LastCycle_UpsertAndClearPerSymbol()
    {
        await using var db = CreateDb();
        var svc = new BotConfigService(db);
        var at = DateTimeOffset.UtcNow;

        var up = await svc.UpsertLastCycleAsync(new UpsertBotLastCycleRequest(
            "nvda", "2026-09-11", "cid-1", at, "dry_run", 0));
        Assert.True(up.Ok, up.Error);

        await svc.UpsertLastCycleAsync(new UpsertBotLastCycleRequest(
            "RKLB", "2026-09-11", "cid-2", at, "filled", 1));
        await svc.UpsertLastCycleAsync(new UpsertBotLastCycleRequest(
            "NVDA", "2026-09-11", "cid-1b", at.AddMinutes(5), "filled", 1));

        var config = await svc.GetConfigAsync();
        Assert.Equal(2, config.LastCycles.Count);
        var nvda = config.LastCycles.Single(c => c.Symbol == "NVDA");
        Assert.Equal("cid-1b", nvda.ClientOrderId);
        Assert.Equal(1, nvda.RetryIndex);

        Assert.Equal(1, await svc.ClearLastCycleAsync("NVDA"));
        config = await svc.GetConfigAsync();
        Assert.Single(config.LastCycles);
        Assert.Equal("RKLB", config.LastCycles[0].Symbol);

        Assert.Equal(1, await svc.ClearLastCycleAsync(null));
        config = await svc.GetConfigAsync();
        Assert.Empty(config.LastCycles);
    }
}
