using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Orders;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Tests;

public class TradeOutcomeServiceTests
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

    private static DecisionSnapshotDto SampleSnapshot(
        string right = "put", string wheelSide = "csp", string level = "regular") =>
        new(
            Underlying: "NVDA",
            OptionRight: right,
            WheelSide: wheelSide,
            Level: level,
            ModelStrike: 150m,
            SnappedStrike: 150m,
            TargetDelta: 0.30,
            HmmRegime: "bull",
            SpotAtSubmit: 160m,
            SuggestedLimit: 1.25m,
            MidAtSubmit: 1.30m,
            BidAtSubmit: 1.20m,
            Dte: 5,
            Granularity: "weekly",
            EarningsInWindow: false,
            EmpiricalAssignmentProb: 0.28,
            EstPremium: 1.40,
            ContractSymbol: "NVDA250801P00150000");

    [Fact]
    public void BuildCohortKey_BucketsDte()
    {
        var key = ITradeOutcomeService.BuildCohortKey("put", "regular", "bull", 5, false);
        Assert.Contains("dte0-7", key);
        Assert.Contains("put", key);
        Assert.Contains("earn0", key);
    }

    [Fact]
    public async Task AttachSnapshot_IsImmutable()
    {
        await using var db = CreateDb();
        var svc = new TradeOutcomeService(db);
        var (ok1, row1, _) = await svc.AttachSnapshotAsync("cid-1", SampleSnapshot(), "desk");
        Assert.True(ok1);
        Assert.NotNull(row1!.DecisionSnapshotJson);

        var (ok2, _, err) = await svc.AttachSnapshotAsync(
            "cid-1", SampleSnapshot() with { SpotAtSubmit = 999m }, "desk");
        Assert.False(ok2);
        Assert.Contains("immutable", err);
    }

    [Fact]
    public async Task SyncFromBrokerOrder_SetsFillEconomics()
    {
        await using var db = CreateDb();
        var svc = new TradeOutcomeService(db);
        await svc.AttachSnapshotAsync("cid-fill", SampleSnapshot(), "desk");

        using var doc = JsonDocument.Parse("""
            {
              "id": "ord-1",
              "client_order_id": "cid-fill",
              "symbol": "NVDA250801P00150000",
              "side": "sell",
              "qty": "1",
              "filled_qty": "1",
              "filled_avg_price": "1.25",
              "status": "filled",
              "limit_price": "1.25"
            }
            """);
        await svc.SyncFromBrokerOrderAsync("cid-fill", doc.RootElement);

        var row = await svc.GetByClientOrderIdAsync("cid-fill");
        Assert.NotNull(row);
        Assert.Equal("1.25", row!.FilledAvgPrice);
        Assert.Equal(125m, row.PremiumCash);
        Assert.Equal(TradeOutcomeLabels.FilledOpen, row.OutcomeLabel);
    }

    [Fact]
    public async Task ResolveAssigned_CreatesWheelCycle()
    {
        await using var db = CreateDb();
        var svc = new TradeOutcomeService(db);
        await svc.AttachSnapshotAsync("cid-a", SampleSnapshot(), "desk");
        using var doc = JsonDocument.Parse("""
            {
              "id": "ord-a",
              "symbol": "NVDA250801P00150000",
              "side": "sell",
              "qty": "1",
              "filled_qty": "1",
              "filled_avg_price": "1.00",
              "status": "filled"
            }
            """);
        await svc.SyncFromBrokerOrderAsync("cid-a", doc.RootElement);

        var (ok, row, _) = await svc.ResolveAsync(
            "cid-a", new ResolveOutcomeRequest(OutcomeLabel: TradeOutcomeLabels.Assigned));
        Assert.True(ok);
        Assert.Equal(TradeOutcomeLabels.Assigned, row!.OutcomeLabel);
        Assert.False(string.IsNullOrEmpty(row.WheelCycleId));
    }

    [Fact]
    public async Task CcSnapshot_LinksToAssignedCycle()
    {
        await using var db = CreateDb();
        var svc = new TradeOutcomeService(db);
        await svc.AttachSnapshotAsync("cid-csp", SampleSnapshot("put", "csp"), "desk");
        await svc.ResolveAsync("cid-csp", new ResolveOutcomeRequest(OutcomeLabel: TradeOutcomeLabels.Assigned));
        var csp = await svc.GetByClientOrderIdAsync("cid-csp");
        Assert.NotNull(csp!.WheelCycleId);

        var (ok, cc, _) = await svc.AttachSnapshotAsync(
            "cid-cc",
            SampleSnapshot("call", "cc") with { ContractSymbol = "NVDA250808C00160000" },
            "desk");
        Assert.True(ok);
        Assert.Equal(csp.WheelCycleId, cc!.WheelCycleId);
    }

    [Fact]
    public async Task BuildRetrospective_CohortsAndAnomalies()
    {
        await using var db = CreateDb();
        var svc = new TradeOutcomeService(db);
        for (var i = 0; i < 3; i++)
        {
            var cid = $"cid-{i}";
            await svc.AttachSnapshotAsync(
                cid,
                SampleSnapshot() with { EmpiricalAssignmentProb = 0.05 },
                "desk");
            using var doc = JsonDocument.Parse($$"""
                {
                  "id": "ord-{{i}}",
                  "symbol": "NVDA250801P00150000",
                  "side": "sell",
                  "qty": "1",
                  "filled_qty": "1",
                  "filled_avg_price": "1.00",
                  "status": "filled"
                }
                """);
            await svc.SyncFromBrokerOrderAsync(cid, doc.RootElement);
            await svc.ResolveAsync(cid, new ResolveOutcomeRequest(
                OutcomeLabel: i == 0 ? TradeOutcomeLabels.Assigned : TradeOutcomeLabels.ExpiredOtm,
                RealizedPnL: 100m));
        }

        var rows = await svc.ListAsync(null, null, null, 50);
        var summary = svc.BuildRetrospective(rows);
        Assert.Equal(3, summary.LearningSampleSize);
        Assert.True(summary.Cohorts.Count >= 1);
        Assert.Contains(summary.Anomalies, a => a.ClientOrderId == "cid-0");
    }
}

public class ExperiencePriorServiceTests
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
    public async Task GetSignal_IdleBelowMinSamples()
    {
        await using var db = CreateDb();
        var opts = Microsoft.Extensions.Options.Options.Create(new AnalysisOptions { ExperienceMinSamples = 20 });
        var svc = new ExperiencePriorService(db, opts);
        var signal = await svc.GetSignalAsync("NVDA", "put", "regular", "bull", 5, false);
        Assert.Equal(0, signal.Confidence);
        Assert.Null(signal.BiasDelta);
        Assert.Contains("idle", signal.Reasons[0], StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetSignal_EmitsBiasWhenAssignmentExceedsModel()
    {
        await using var db = CreateDb();
        var outcomes = new TradeOutcomeService(db);
        for (var i = 0; i < 20; i++)
        {
            var cid = $"exp-{i}";
            await outcomes.AttachSnapshotAsync(cid, new DecisionSnapshotDto(
                "NVDA", "put", "csp", "regular", 150m, 150m, 0.30, "bull",
                160m, 1.2m, 1.2m, 1.1m, 5, "weekly", false, 0.20, 1.2,
                "NVDA250801P00150000"), "desk");
            // Half assigned → 50% vs model 20%
            await outcomes.ResolveAsync(cid, new ResolveOutcomeRequest(
                OutcomeLabel: i < 10 ? TradeOutcomeLabels.Assigned : TradeOutcomeLabels.ExpiredOtm));
        }

        var opts = Microsoft.Extensions.Options.Options.Create(new AnalysisOptions
        {
            ExperienceMinSamples = 20,
            ExperienceAssignmentErrorThreshold = 0.10,
            ExperienceMaxBiasDelta = 0.05,
        });
        var svc = new ExperiencePriorService(db, opts);
        var signal = await svc.GetSignalAsync("NVDA", "put", "regular", "bull", 5, false);
        Assert.True(signal.SampleSize >= 20);
        Assert.NotNull(signal.BiasDelta);
        Assert.True(signal.BiasDelta < 0);
        Assert.True(signal.Confidence > 0);
    }
}
