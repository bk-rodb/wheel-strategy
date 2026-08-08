using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Models;

namespace WheelStrategy.Api.Orders;

public interface IOrderJournalService
{
    Task<OrderJournalEntry?> GetByClientOrderIdAsync(string clientOrderId, CancellationToken ct = default);

    Task<OrderJournalEntry?> GetOpenForUnderlyingAsync(string underlying, CancellationToken ct = default);

    Task<IReadOnlyList<OrderJournalEntry>> ListAsync(
        string? underlying, bool openOnly, int limit, CancellationToken ct = default);

    /// <summary>
    /// Rejects when another non-terminal intent exists for the underlying
    /// (unless it is the same client_order_id — idempotent retry).
    /// </summary>
    Task<(bool ok, OrderJournalEntry? conflict, string? error)> TryBeginPlaceAsync(
        PlaceIntent intent, CancellationToken ct = default);

    Task MarkBlockedAsync(PlaceIntent intent, string reason, CancellationToken ct = default);

    Task MarkRejectedLocalAsync(PlaceIntent intent, string reason, CancellationToken ct = default);

    Task MarkOrphanCheckAsync(string clientOrderId, string detail, CancellationToken ct = default);

    Task MarkSubmitFailedAsync(string clientOrderId, string detail, CancellationToken ct = default);

    Task ApplyBrokerOrderJsonAsync(
        string clientOrderId, JsonElement order, string? deskOverride = null, CancellationToken ct = default);

    Task MarkCancelRequestedAsync(string alpacaOrderId, CancellationToken ct = default);

    Task MarkCancelPendingAsync(string alpacaOrderId, CancellationToken ct = default);

    OrderJournalDto ToDto(OrderJournalEntry e);
}

public record PlaceIntent(
    string ClientOrderId,
    string Symbol,
    string Side,
    string Qty,
    string? LimitPrice,
    string Source);

public sealed class OrderJournalService(WheelStrategyDbContext db) : IOrderJournalService
{
    public async Task<OrderJournalEntry?> GetByClientOrderIdAsync(
        string clientOrderId, CancellationToken ct = default)
    {
        return await db.OrderJournalEntries
            .FirstOrDefaultAsync(e => e.ClientOrderId == clientOrderId, ct);
    }

    public async Task<OrderJournalEntry?> GetOpenForUnderlyingAsync(
        string underlying, CancellationToken ct = default)
    {
        var u = underlying.ToUpperInvariant();
        var open = await ListAsync(u, openOnly: true, limit: 1, ct);
        return open.FirstOrDefault();
    }

    public async Task<IReadOnlyList<OrderJournalEntry>> ListAsync(
        string? underlying, bool openOnly, int limit, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        var q = db.OrderJournalEntries.AsQueryable();
        if (!string.IsNullOrWhiteSpace(underlying))
        {
            var u = underlying.Trim().ToUpperInvariant();
            q = q.Where(e => e.Underlying == u);
        }

        var rows = await q.OrderByDescending(e => e.UpdatedAt).Take(limit * 4).ToListAsync(ct);
        if (openOnly)
            rows = rows.Where(e => JournalDeskStates.IsOpen(e.DeskState)).ToList();

        return rows.Take(limit).ToList();
    }

    public async Task<(bool ok, OrderJournalEntry? conflict, string? error)> TryBeginPlaceAsync(
        PlaceIntent intent, CancellationToken ct = default)
    {
        var underlying = OptionSymbol.UnderlyingFromOsi(intent.Symbol);
        var existingSame = await GetByClientOrderIdAsync(intent.ClientOrderId, ct);
        if (existingSame is not null)
        {
            if (JournalDeskStates.IsOpen(existingSame.DeskState)
                || !string.IsNullOrEmpty(existingSame.AlpacaOrderId))
            {
                // Idempotent retry of an already-known intent.
                existingSame.UpdatedAt = DateTime.UtcNow;
                if (JournalDeskStates.IsOpen(existingSame.DeskState)
                    && existingSame.DeskState is not JournalDeskStates.OrphanCheck)
                {
                    existingSame.DeskState = JournalDeskStates.Submitting;
                }
                await db.SaveChangesAsync(ct);
                return (true, null, null);
            }
        }

        var conflict = await GetOpenForUnderlyingAsync(underlying, ct);
        if (conflict is not null && conflict.ClientOrderId != intent.ClientOrderId)
        {
            return (false, conflict,
                $"An order for {underlying} is already open (client_order_id={conflict.ClientOrderId}).");
        }

        if (existingSame is null)
        {
            db.OrderJournalEntries.Add(new OrderJournalEntry
            {
                ClientOrderId = intent.ClientOrderId,
                Underlying = underlying,
                Symbol = intent.Symbol,
                Side = intent.Side,
                Qty = intent.Qty,
                FilledQty = "0",
                LimitPrice = intent.LimitPrice,
                DeskState = JournalDeskStates.Submitting,
                Source = NormalizeSource(intent.Source),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existingSame.Underlying = underlying;
            existingSame.Symbol = intent.Symbol;
            existingSame.Side = intent.Side;
            existingSame.Qty = intent.Qty;
            existingSame.LimitPrice = intent.LimitPrice;
            existingSame.DeskState = JournalDeskStates.Submitting;
            existingSame.Source = NormalizeSource(intent.Source);
            existingSame.LastError = null;
            existingSame.TerminalAt = null;
            existingSame.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return (true, null, null);
    }

    public async Task MarkBlockedAsync(PlaceIntent intent, string reason, CancellationToken ct = default)
    {
        await UpsertTerminalLocalAsync(intent, JournalDeskStates.Blocked, reason, ct);
    }

    public async Task MarkRejectedLocalAsync(PlaceIntent intent, string reason, CancellationToken ct = default)
    {
        await UpsertTerminalLocalAsync(intent, JournalDeskStates.RejectedLocal, reason, ct);
    }

    public async Task MarkOrphanCheckAsync(string clientOrderId, string detail, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null) return;
        row.DeskState = JournalDeskStates.OrphanCheck;
        row.LastError = Truncate(detail);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task MarkSubmitFailedAsync(string clientOrderId, string detail, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null) return;
        row.DeskState = JournalDeskStates.SubmitFailed;
        row.LastError = Truncate(detail);
        row.TerminalAt = DateTime.UtcNow;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task ApplyBrokerOrderJsonAsync(
        string clientOrderId, JsonElement order, string? deskOverride = null, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null)
        {
            // Late discover from reconcile — create a row if we can read fields.
            if (!TryReadString(order, "client_order_id", out var cid) || cid != clientOrderId)
                return;
            if (!TryReadString(order, "symbol", out var symbol)) return;
            row = new OrderJournalEntry
            {
                ClientOrderId = clientOrderId,
                Underlying = OptionSymbol.UnderlyingFromOsi(symbol),
                Symbol = symbol,
                Side = TryReadString(order, "side", out var side) ? side : "",
                Qty = TryReadString(order, "qty", out var qty) ? qty : "0",
                Source = "desk",
                CreatedAt = DateTime.UtcNow,
            };
            db.OrderJournalEntries.Add(row);
        }

        if (TryReadString(order, "id", out var id))
            row.AlpacaOrderId = id;
        if (TryReadString(order, "symbol", out var sym))
        {
            row.Symbol = sym;
            row.Underlying = OptionSymbol.UnderlyingFromOsi(sym);
        }
        if (TryReadString(order, "side", out var s)) row.Side = s;
        if (TryReadString(order, "qty", out var q)) row.Qty = q;
        if (TryReadString(order, "filled_qty", out var fq)) row.FilledQty = fq;
        if (order.TryGetProperty("limit_price", out var lp)
            && lp.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
        {
            row.LimitPrice = lp.ValueKind == JsonValueKind.String
                ? lp.GetString()
                : lp.ToString();
        }
        if (TryReadString(order, "status", out var status))
            row.BrokerStatus = status;

        row.DeskState = deskOverride
            ?? JournalDeskStates.FromBrokerStatus(row.BrokerStatus, row.Qty, row.FilledQty);
        row.LastError = null;
        row.UpdatedAt = DateTime.UtcNow;
        if (!JournalDeskStates.IsOpen(row.DeskState))
            row.TerminalAt ??= DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
    }

    public async Task MarkCancelRequestedAsync(string alpacaOrderId, CancellationToken ct = default)
    {
        var row = await db.OrderJournalEntries
            .FirstOrDefaultAsync(e => e.AlpacaOrderId == alpacaOrderId, ct);
        if (row is null) return;
        row.DeskState = JournalDeskStates.CancelRequested;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task MarkCancelPendingAsync(string alpacaOrderId, CancellationToken ct = default)
    {
        var row = await db.OrderJournalEntries
            .FirstOrDefaultAsync(e => e.AlpacaOrderId == alpacaOrderId, ct);
        if (row is null) return;
        row.DeskState = JournalDeskStates.CancelPending;
        row.BrokerStatus = "pending_cancel";
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public OrderJournalDto ToDto(OrderJournalEntry e) => new(
        e.ClientOrderId,
        e.AlpacaOrderId,
        e.Underlying,
        e.Symbol,
        e.Side,
        e.Qty,
        e.FilledQty,
        e.LimitPrice,
        e.DeskState,
        e.BrokerStatus,
        e.Source,
        e.LastError,
        new DateTimeOffset(DateTime.SpecifyKind(e.CreatedAt, DateTimeKind.Utc)),
        new DateTimeOffset(DateTime.SpecifyKind(e.UpdatedAt, DateTimeKind.Utc)),
        e.TerminalAt is null
            ? null
            : new DateTimeOffset(DateTime.SpecifyKind(e.TerminalAt.Value, DateTimeKind.Utc)));

    private async Task UpsertTerminalLocalAsync(
        PlaceIntent intent, string deskState, string reason, CancellationToken ct)
    {
        var underlying = OptionSymbol.UnderlyingFromOsi(intent.Symbol);
        var row = await GetByClientOrderIdAsync(intent.ClientOrderId, ct);
        if (row is null)
        {
            row = new OrderJournalEntry
            {
                ClientOrderId = intent.ClientOrderId,
                Underlying = underlying,
                Symbol = intent.Symbol,
                Side = intent.Side,
                Qty = intent.Qty,
                LimitPrice = intent.LimitPrice,
                Source = NormalizeSource(intent.Source),
                CreatedAt = DateTime.UtcNow,
            };
            db.OrderJournalEntries.Add(row);
        }

        row.DeskState = deskState;
        row.LastError = Truncate(reason);
        row.TerminalAt = DateTime.UtcNow;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static string NormalizeSource(string source) =>
        string.Equals(source, "bot", StringComparison.OrdinalIgnoreCase) ? "bot" : "desk";

    private static string Truncate(string s) =>
        s.Length <= 500 ? s : s[..500];

    private static bool TryReadString(JsonElement el, string name, out string value)
    {
        value = string.Empty;
        if (!el.TryGetProperty(name, out var p)) return false;
        if (p.ValueKind == JsonValueKind.String)
        {
            value = p.GetString() ?? string.Empty;
            return value.Length > 0;
        }
        if (p.ValueKind is JsonValueKind.Number)
        {
            value = p.ToString();
            return true;
        }
        return false;
    }
}
