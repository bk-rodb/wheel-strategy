using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Orders;

namespace WheelStrategy.Api.Tests;

public class OrderJournalServiceTests
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
    public void OptionSymbol_UnderlyingFromCompactOsi()
    {
        Assert.Equal("NVDA", OptionSymbol.UnderlyingFromOsi("NVDA250801P00150000"));
        Assert.Equal("AAPL", OptionSymbol.UnderlyingFromOsi("AAPL  250117C00150000"));
    }

    [Fact]
    public void JournalDeskStates_FromBrokerStatus_MapsTerminals()
    {
        Assert.Equal(JournalDeskStates.Filled, JournalDeskStates.FromBrokerStatus("filled", "1", "1"));
        Assert.Equal(JournalDeskStates.PartialFilled, JournalDeskStates.FromBrokerStatus("canceled", "2", "1"));
        Assert.Equal(JournalDeskStates.Canceled, JournalDeskStates.FromBrokerStatus("canceled", "1", "0"));
        Assert.Equal(JournalDeskStates.AckPending, JournalDeskStates.FromBrokerStatus("pending_new", "1", "0"));
        Assert.Equal(JournalDeskStates.Filled, JournalDeskStates.FromBrokerStatus("done_for_day", "1", "1"));
        Assert.Equal(JournalDeskStates.Canceled, JournalDeskStates.FromBrokerStatus("done_for_day", "1", "0"));
    }

    [Fact]
    public async Task TryBeginPlace_CreatesSubmittingRow()
    {
        await using var db = CreateDb();
        var svc = new OrderJournalService(db);
        var intent = new PlaceIntent(
            "cid-1", "NVDA250801P00150000", "sell", "1", "1.25", "desk");

        var (ok, conflict, err) = await svc.TryBeginPlaceAsync(intent);
        Assert.True(ok);
        Assert.Null(conflict);
        Assert.Null(err);

        var row = await svc.GetByClientOrderIdAsync("cid-1");
        Assert.NotNull(row);
        Assert.Equal("NVDA", row!.Underlying);
        Assert.Equal(JournalDeskStates.Submitting, row.DeskState);
    }

    [Fact]
    public async Task TryBeginPlace_RejectsSecondUnderlying()
    {
        await using var db = CreateDb();
        var svc = new OrderJournalService(db);
        await svc.TryBeginPlaceAsync(new PlaceIntent(
            "cid-1", "NVDA250801P00150000", "sell", "1", "1.25", "desk"));

        var (ok, conflict, err) = await svc.TryBeginPlaceAsync(new PlaceIntent(
            "cid-2", "NVDA250808P00145000", "sell", "1", "1.00", "bot"));

        Assert.False(ok);
        Assert.NotNull(conflict);
        Assert.Equal("cid-1", conflict!.ClientOrderId);
        Assert.Contains("already open", err);
    }

    [Fact]
    public async Task TryBeginPlace_SameClientId_IsIdempotent()
    {
        await using var db = CreateDb();
        var svc = new OrderJournalService(db);
        var intent = new PlaceIntent(
            "cid-1", "NVDA250801P00150000", "sell", "1", "1.25", "desk");
        await svc.TryBeginPlaceAsync(intent);
        var (ok, conflict, _) = await svc.TryBeginPlaceAsync(intent);
        Assert.True(ok);
        Assert.Null(conflict);
        Assert.Single(await svc.ListAsync("NVDA", openOnly: false, limit: 10));
    }

    [Fact]
    public async Task ApplyBrokerOrder_UpdatesWorking()
    {
        await using var db = CreateDb();
        var svc = new OrderJournalService(db);
        await svc.TryBeginPlaceAsync(new PlaceIntent(
            "cid-1", "NVDA250801P00150000", "sell", "1", "1.25", "desk"));

        using var doc = System.Text.Json.JsonDocument.Parse("""
            {
              "id": "alp-99",
              "client_order_id": "cid-1",
              "symbol": "NVDA250801P00150000",
              "qty": "1",
              "filled_qty": "0",
              "side": "sell",
              "status": "accepted",
              "limit_price": "1.25"
            }
            """);
        await svc.ApplyBrokerOrderJsonAsync("cid-1", doc.RootElement);

        var row = await svc.GetByClientOrderIdAsync("cid-1");
        Assert.Equal("alp-99", row!.AlpacaOrderId);
        Assert.Equal(JournalDeskStates.Working, row.DeskState);
        Assert.Equal("accepted", row.BrokerStatus);
    }

    [Fact]
    public async Task MarkSubmitFailed_AfterOrphan()
    {
        await using var db = CreateDb();
        var svc = new OrderJournalService(db);
        await svc.TryBeginPlaceAsync(new PlaceIntent(
            "cid-1", "NVDA250801P00150000", "sell", "1", null, "desk"));
        await svc.MarkOrphanCheckAsync("cid-1", "timeout");
        await svc.MarkSubmitFailedAsync("cid-1", "not found");

        var row = await svc.GetByClientOrderIdAsync("cid-1");
        Assert.Equal(JournalDeskStates.SubmitFailed, row!.DeskState);
        Assert.False(JournalDeskStates.IsOpen(row.DeskState));
    }
}
