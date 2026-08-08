using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Models;
using WheelStrategy.Api.Orders;

namespace WheelStrategy.Api.Services;

public interface ITradeOutcomeService
{
    Task<TradeOutcome?> GetByClientOrderIdAsync(string clientOrderId, CancellationToken ct = default);

    Task<IReadOnlyList<TradeOutcome>> ListAsync(
        string? underlying, string? outcomeLabel, bool? resolvedOnly, int limit, CancellationToken ct = default);

    /// <summary>Attach immutable snapshot; creates row if missing. Rejects mutation if snapshot already set.</summary>
    Task<(bool ok, TradeOutcome? row, string? error)> AttachSnapshotAsync(
        string clientOrderId, DecisionSnapshotDto snapshot, string source, CancellationToken ct = default);

    Task SyncFromBrokerOrderAsync(string clientOrderId, JsonElement order, CancellationToken ct = default);

    Task MarkCanceledBeforeFillAsync(string clientOrderId, CancellationToken ct = default);

    Task<(bool ok, TradeOutcome? row, string? error)> ResolveAsync(
        string clientOrderId, ResolveOutcomeRequest req, CancellationToken ct = default);

    Task<int> ResolveFromActivitiesAsync(
        string clientOrderId, IReadOnlyList<JsonElement> activities, CancellationToken ct = default);

    Task<string> EnsureWheelCycleAsync(string underlying, string? existingCycleId, CancellationToken ct = default);

    Task LinkCycleOnAssignmentAsync(string clientOrderId, CancellationToken ct = default);

    Task LinkCcToOpenCycleAsync(string clientOrderId, string underlying, CancellationToken ct = default);

    RetrospectiveSummaryDto BuildRetrospective(IReadOnlyList<TradeOutcome> rows);

    string ToCsv(IReadOnlyList<TradeOutcome> rows);

    TradeOutcomeDto ToDto(TradeOutcome e);

    static string BuildCohortKey(
        string? optionRight, string? level, string? hmmRegime, int? dte, bool? earningsInWindow, string? underlying = null)
    {
        var dteBucket = DteBucket(dte);
        var earn = earningsInWindow == true ? "earn1" : "earn0";
        var u = string.IsNullOrWhiteSpace(underlying) ? "ALL" : underlying.Trim().ToUpperInvariant();
        return $"{u}|{optionRight ?? "?"}|{level ?? "?"}|{hmmRegime ?? "?"}|{dteBucket}|{earn}";
    }

    static string DteBucket(int? dte) => dte switch
    {
        null => "dte?",
        <= 7 => "dte0-7",
        <= 14 => "dte8-14",
        <= 35 => "dte15-35",
        _ => "dte36+",
    };
}

public sealed class TradeOutcomeService(WheelStrategyDbContext db) : ITradeOutcomeService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public async Task<TradeOutcome?> GetByClientOrderIdAsync(
        string clientOrderId, CancellationToken ct = default)
    {
        return await db.TradeOutcomes
            .FirstOrDefaultAsync(e => e.ClientOrderId == clientOrderId, ct);
    }

    public async Task<IReadOnlyList<TradeOutcome>> ListAsync(
        string? underlying, string? outcomeLabel, bool? resolvedOnly, int limit, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 500);
        var q = db.TradeOutcomes.AsQueryable();
        if (!string.IsNullOrWhiteSpace(underlying))
        {
            var u = underlying.Trim().ToUpperInvariant();
            q = q.Where(e => e.Underlying == u);
        }
        if (!string.IsNullOrWhiteSpace(outcomeLabel))
            q = q.Where(e => e.OutcomeLabel == outcomeLabel);

        var rows = await q.OrderByDescending(e => e.UpdatedAt).Take(limit * 2).ToListAsync(ct);
        if (resolvedOnly == true)
            rows = rows.Where(e => TradeOutcomeLabels.IsResolved(e.OutcomeLabel)).ToList();
        return rows.Take(limit).ToList();
    }

    public async Task<(bool ok, TradeOutcome? row, string? error)> AttachSnapshotAsync(
        string clientOrderId, DecisionSnapshotDto snapshot, string source, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(clientOrderId))
            return (false, null, "clientOrderId is required.");

        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is not null && !string.IsNullOrEmpty(row.DecisionSnapshotJson))
        {
            // Idempotent if same payload; otherwise immutable.
            var existing = JsonSerializer.Serialize(row.SnapshotFromStored() ?? snapshot, JsonOpts);
            var incoming = JsonSerializer.Serialize(snapshot, JsonOpts);
            if (string.Equals(existing, incoming, StringComparison.Ordinal))
                return (true, row, null);
            return (false, row, "Decision snapshot is immutable once set.");
        }

        row ??= new TradeOutcome
        {
            ClientOrderId = clientOrderId,
            CreatedAt = DateTime.UtcNow,
            OutcomeLabel = TradeOutcomeLabels.Pending,
        };
        if (row.Id == 0)
            db.TradeOutcomes.Add(row);

        ApplySnapshotFields(row, snapshot, source);
        row.DecisionSnapshotJson = JsonSerializer.Serialize(snapshot, JsonOpts);
        row.CohortKey = ITradeOutcomeService.BuildCohortKey(
            row.OptionRight, row.Level, row.HmmRegime, row.Dte, row.EarningsInWindow, underlying: null);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        // Phase D: CC legs attach to open assigned CSP cycle when possible.
        if (string.Equals(row.WheelSide, "cc", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrEmpty(row.WheelCycleId))
        {
            await LinkCcToOpenCycleAsync(clientOrderId, row.Underlying, ct);
            row = await GetByClientOrderIdAsync(clientOrderId, ct) ?? row;
        }

        return (true, row, null);
    }

    public async Task SyncFromBrokerOrderAsync(
        string clientOrderId, JsonElement order, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null)
        {
            if (!TryReadString(order, "symbol", out var symbol)) return;
            row = new TradeOutcome
            {
                ClientOrderId = clientOrderId,
                Underlying = OptionSymbol.UnderlyingFromOsi(symbol),
                Symbol = symbol,
                OptionRight = OptionSymbol.OptionRightFromOsi(symbol),
                Side = TryReadString(order, "side", out var side) ? side : "sell",
                Qty = TryReadString(order, "qty", out var qty) ? qty : "0",
                OutcomeLabel = TradeOutcomeLabels.Pending,
                CreatedAt = DateTime.UtcNow,
            };
            db.TradeOutcomes.Add(row);
        }

        if (TryReadString(order, "id", out var id))
            row.AlpacaOrderId = id;
        if (TryReadString(order, "symbol", out var sym))
        {
            row.Symbol = sym;
            row.Underlying = OptionSymbol.UnderlyingFromOsi(sym);
            if (string.IsNullOrEmpty(row.OptionRight))
                row.OptionRight = OptionSymbol.OptionRightFromOsi(sym);
        }
        if (TryReadString(order, "side", out var s)) row.Side = s;
        if (TryReadString(order, "qty", out var q)) row.Qty = q;
        if (TryReadString(order, "filled_qty", out var fq)) row.FilledQty = fq;

        if (order.TryGetProperty("limit_price", out var lp)
            && lp.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
        {
            row.LimitPrice = lp.ValueKind == JsonValueKind.String ? lp.GetString() : lp.ToString();
        }

        if (order.TryGetProperty("filled_avg_price", out var fap)
            && fap.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
        {
            var avg = fap.ValueKind == JsonValueKind.String ? fap.GetString() : fap.ToString();
            if (!string.IsNullOrWhiteSpace(avg))
            {
                row.FilledAvgPrice = avg;
                row.PremiumCash = ComputePremiumCash(avg, row.FilledQty, row.Side);
                row.FilledAt ??= DateTime.UtcNow;
                if (row.OutcomeLabel is TradeOutcomeLabels.Pending or TradeOutcomeLabels.Unknown)
                    row.OutcomeLabel = TradeOutcomeLabels.FilledOpen;
            }
        }

        if (TryReadString(order, "status", out var status))
        {
            if (status is "canceled" or "cancelled" or "expired")
            {
                var filled = ParseDecimal(row.FilledQty) ?? 0;
                if (filled <= 0 && row.OutcomeLabel is not (
                    TradeOutcomeLabels.ExpiredOtm or TradeOutcomeLabels.Assigned
                    or TradeOutcomeLabels.BoughtToClose))
                {
                    row.OutcomeLabel = TradeOutcomeLabels.CanceledBeforeFill;
                    row.ResolvedAt ??= DateTime.UtcNow;
                }
            }
            else if (status is "filled" or "partially_filled")
            {
                if (row.OutcomeLabel == TradeOutcomeLabels.Pending)
                    row.OutcomeLabel = TradeOutcomeLabels.FilledOpen;
            }
        }

        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task MarkCanceledBeforeFillAsync(string clientOrderId, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null) return;
        var filled = ParseDecimal(row.FilledQty) ?? 0;
        if (filled > 0) return;
        if (TradeOutcomeLabels.IsResolved(row.OutcomeLabel)) return;
        row.OutcomeLabel = TradeOutcomeLabels.CanceledBeforeFill;
        row.ResolvedAt = DateTime.UtcNow;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<(bool ok, TradeOutcome? row, string? error)> ResolveAsync(
        string clientOrderId, ResolveOutcomeRequest req, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null)
            return (false, null, "Outcome not found.");

        if (!string.IsNullOrWhiteSpace(req.OutcomeLabel))
        {
            row.OutcomeLabel = req.OutcomeLabel.Trim().ToLowerInvariant();
            if (TradeOutcomeLabels.IsResolved(row.OutcomeLabel))
                row.ResolvedAt ??= DateTime.UtcNow;
        }

        if (req.RealizedPnL is not null)
            row.RealizedPnL = req.RealizedPnL;

        if (!string.IsNullOrWhiteSpace(req.WheelCycleId))
            row.WheelCycleId = req.WheelCycleId.Trim();

        if (row.OutcomeLabel == TradeOutcomeLabels.Assigned)
            await LinkCycleOnAssignmentAsync(clientOrderId, ct);

        FlagAnomalyIfNeeded(row);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return (true, row, null);
    }

    public async Task<int> ResolveFromActivitiesAsync(
        string clientOrderId, IReadOnlyList<JsonElement> activities, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null) return 0;

        var matched = 0;
        foreach (var act in activities)
        {
            if (!TryReadString(act, "symbol", out var sym)) continue;
            if (!string.Equals(sym, row.Symbol, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(sym, row.Underlying, StringComparison.OrdinalIgnoreCase))
                continue;

            var activityType = TryReadString(act, "activity_type", out var at) ? at
                : TryReadString(act, "type", out var t) ? t : "";

            if (activityType.Equals("OPASN", StringComparison.OrdinalIgnoreCase)
                || activityType.Equals("assignment", StringComparison.OrdinalIgnoreCase))
            {
                row.OutcomeLabel = TradeOutcomeLabels.Assigned;
                row.ResolvedAt ??= DateTime.UtcNow;
                matched++;
                await LinkCycleOnAssignmentAsync(clientOrderId, ct);
            }
            else if (activityType.Equals("OPEXP", StringComparison.OrdinalIgnoreCase)
                     || activityType.Equals("expiration", StringComparison.OrdinalIgnoreCase))
            {
                row.OutcomeLabel = TradeOutcomeLabels.ExpiredOtm;
                row.ResolvedAt ??= DateTime.UtcNow;
                // Sell-to-open expired OTM: keep premium as realized.
                row.RealizedPnL ??= row.PremiumCash;
                matched++;
            }
            else if (activityType.Equals("FILL", StringComparison.OrdinalIgnoreCase)
                     && TryReadString(act, "side", out var side)
                     && side.Equals("buy", StringComparison.OrdinalIgnoreCase)
                     && row.OutcomeLabel == TradeOutcomeLabels.FilledOpen)
            {
                // Likely BTC fill for this contract.
                row.OutcomeLabel = TradeOutcomeLabels.BoughtToClose;
                row.ResolvedAt ??= DateTime.UtcNow;
                if (TryReadString(act, "price", out var px) && ParseDecimal(px) is { } buyPx
                    && ParseDecimal(row.FilledAvgPrice) is { } sellPx
                    && ParseDecimal(row.FilledQty) is { } qty)
                {
                    // Short premium: credit on sell, debit on buy — per contract * 100.
                    row.RealizedPnL = (sellPx - buyPx) * qty * 100m;
                }
                matched++;
            }
        }

        if (matched > 0)
        {
            FlagAnomalyIfNeeded(row);
            row.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return matched;
    }

    public async Task<string> EnsureWheelCycleAsync(
        string underlying, string? existingCycleId, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(existingCycleId))
            return existingCycleId.Trim();
        var id = $"wc_{underlying.ToUpperInvariant()}_{Guid.NewGuid():N}"[..40];
        await Task.CompletedTask;
        return id;
    }

    public async Task LinkCycleOnAssignmentAsync(string clientOrderId, CancellationToken ct = default)
    {
        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null) return;
        if (!string.IsNullOrEmpty(row.WheelCycleId)) return;

        row.WheelCycleId = await EnsureWheelCycleAsync(row.Underlying, null, ct);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task LinkCcToOpenCycleAsync(
        string clientOrderId, string underlying, CancellationToken ct = default)
    {
        var u = underlying.ToUpperInvariant();
        var openCycle = await db.TradeOutcomes
            .Where(e => e.Underlying == u
                        && e.OutcomeLabel == TradeOutcomeLabels.Assigned
                        && e.WheelCycleId != null)
            .OrderByDescending(e => e.ResolvedAt)
            .FirstOrDefaultAsync(ct);

        if (openCycle?.WheelCycleId is null) return;

        var row = await GetByClientOrderIdAsync(clientOrderId, ct);
        if (row is null) return;
        row.WheelCycleId = openCycle.WheelCycleId;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public RetrospectiveSummaryDto BuildRetrospective(IReadOnlyList<TradeOutcome> rows)
    {
        var learning = rows.Where(r => TradeOutcomeLabels.CountsForLearning(r.OutcomeLabel)).ToList();
        var assigned = learning.Count(r => r.OutcomeLabel == TradeOutcomeLabels.Assigned);
        var overallAssign = learning.Count == 0 ? 0.0 : (double)assigned / learning.Count;

        var cohorts = learning
            .GroupBy(r => r.CohortKey ?? ITradeOutcomeService.BuildCohortKey(
                r.OptionRight, r.Level, r.HmmRegime, r.Dte, r.EarningsInWindow))
            .Select(g =>
            {
                var list = g.ToList();
                var n = list.Count;
                var a = list.Count(x => x.OutcomeLabel == TradeOutcomeLabels.Assigned);
                var avgPrem = list.Where(x => x.PremiumCash is not null).Select(x => x.PremiumCash!.Value).DefaultIfEmpty().Average();
                var avgEst = list.Where(x => x.EstPremium is not null).Select(x => (decimal)x.EstPremium!.Value).DefaultIfEmpty().Average();
                var modelProb = list.Where(x => x.EmpiricalAssignmentProb is not null)
                    .Select(x => x.EmpiricalAssignmentProb!.Value).DefaultIfEmpty().Average();
                var conditions = new List<string>();
                if (list.Any(x => x.EarningsInWindow == true))
                    conditions.Add("earnings_in_window");
                if (list.Any(x => string.Equals(x.HmmRegime, "bear", StringComparison.OrdinalIgnoreCase)))
                    conditions.Add("bear_regime");
                if (list.Any(x => string.Equals(x.HmmRegime, "bull", StringComparison.OrdinalIgnoreCase)))
                    conditions.Add("bull_regime");
                if (list.Any(x => x.Dte is <= 7))
                    conditions.Add("short_dte");
                return new CohortStatDto(
                    g.Key,
                    n,
                    n == 0 ? 0 : (double)a / n,
                    n == 0 ? null : (double?)avgPrem,
                    n == 0 || avgEst == 0 ? null : (double?)avgEst,
                    avgEst == 0 ? null : (double)(avgPrem / avgEst),
                    double.IsNaN(modelProb) ? null : modelProb,
                    conditions.Distinct().ToList());
            })
            .OrderByDescending(c => c.SampleSize)
            .ToList();

        var anomalies = rows.Where(r => r.IsAnomaly)
            .Select(r => new AnomalyDto(
                r.ClientOrderId,
                r.Underlying,
                r.OutcomeLabel,
                r.AnomalyReason,
                r.CohortKey,
                r.RealizedPnL,
                r.ResolvedAt is null
                    ? null
                    : new DateTimeOffset(DateTime.SpecifyKind(r.ResolvedAt.Value, DateTimeKind.Utc))))
            .OrderByDescending(a => a.ResolvedAt)
            .Take(50)
            .ToList();

        var cycles = rows
            .Where(r => !string.IsNullOrEmpty(r.WheelCycleId))
            .GroupBy(r => r.WheelCycleId!)
            .Select(g =>
            {
                var list = g.ToList();
                return new WheelCycleSummaryDto(
                    g.Key,
                    list[0].Underlying,
                    list.Count,
                    list.Sum(x => x.PremiumCash ?? 0),
                    list.Sum(x => x.RealizedPnL ?? 0),
                    list.Select(x => x.ClientOrderId).ToList());
            })
            .OrderByDescending(c => c.TotalRealizedPnL)
            .Take(50)
            .ToList();

        return new RetrospectiveSummaryDto(
            rows.Count,
            rows.Count(r => TradeOutcomeLabels.IsResolved(r.OutcomeLabel)),
            learning.Count,
            overallAssign,
            rows.Sum(r => r.PremiumCash ?? 0),
            rows.Sum(r => r.RealizedPnL ?? 0),
            cohorts,
            anomalies,
            cycles);
    }

    public string ToCsv(IReadOnlyList<TradeOutcome> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(
            "clientOrderId,underlying,symbol,wheelSide,optionRight,level,outcomeLabel,filledAvgPrice,premiumCash,realizedPnL,hmmRegime,cohortKey,isAnomaly,wheelCycleId,filledAt,resolvedAt");
        foreach (var r in rows)
        {
            sb.Append(Csv(r.ClientOrderId)).Append(',')
                .Append(Csv(r.Underlying)).Append(',')
                .Append(Csv(r.Symbol)).Append(',')
                .Append(Csv(r.WheelSide)).Append(',')
                .Append(Csv(r.OptionRight)).Append(',')
                .Append(Csv(r.Level)).Append(',')
                .Append(Csv(r.OutcomeLabel)).Append(',')
                .Append(Csv(r.FilledAvgPrice)).Append(',')
                .Append(r.PremiumCash?.ToString(CultureInfo.InvariantCulture) ?? "").Append(',')
                .Append(r.RealizedPnL?.ToString(CultureInfo.InvariantCulture) ?? "").Append(',')
                .Append(Csv(r.HmmRegime)).Append(',')
                .Append(Csv(r.CohortKey)).Append(',')
                .Append(r.IsAnomaly ? "true" : "false").Append(',')
                .Append(Csv(r.WheelCycleId)).Append(',')
                .Append(r.FilledAt?.ToString("o", CultureInfo.InvariantCulture) ?? "").Append(',')
                .Append(r.ResolvedAt?.ToString("o", CultureInfo.InvariantCulture) ?? "")
                .AppendLine();
        }
        return sb.ToString();
    }

    public TradeOutcomeDto ToDto(TradeOutcome e) => new(
        e.ClientOrderId,
        e.AlpacaOrderId,
        e.WheelCycleId,
        e.Underlying,
        e.Symbol,
        e.Side,
        e.OptionRight,
        e.WheelSide,
        e.Qty,
        e.FilledQty,
        e.LimitPrice,
        e.FilledAvgPrice,
        e.PremiumCash,
        e.Fees,
        e.RealizedPnL,
        e.OutcomeLabel,
        e.Source,
        e.SnapshotFromStored(),
        e.Level,
        e.HmmRegime,
        e.CohortKey,
        e.IsAnomaly,
        e.AnomalyReason,
        new DateTimeOffset(DateTime.SpecifyKind(e.CreatedAt, DateTimeKind.Utc)),
        new DateTimeOffset(DateTime.SpecifyKind(e.UpdatedAt, DateTimeKind.Utc)),
        e.FilledAt is null
            ? null
            : new DateTimeOffset(DateTime.SpecifyKind(e.FilledAt.Value, DateTimeKind.Utc)),
        e.ResolvedAt is null
            ? null
            : new DateTimeOffset(DateTime.SpecifyKind(e.ResolvedAt.Value, DateTimeKind.Utc)));

    private static void ApplySnapshotFields(TradeOutcome row, DecisionSnapshotDto s, string source)
    {
        row.Underlying = s.Underlying.Trim().ToUpperInvariant();
        row.OptionRight = (s.OptionRight ?? "").Trim().ToLowerInvariant();
        row.WheelSide = (s.WheelSide ?? "").Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(s.ContractSymbol))
            row.Symbol = s.ContractSymbol.Trim();
        row.Level = s.Level;
        row.ModelStrike = s.ModelStrike;
        row.SnappedStrike = s.SnappedStrike;
        row.TargetDelta = s.TargetDelta;
        row.HmmRegime = s.HmmRegime;
        row.SpotAtSubmit = s.SpotAtSubmit;
        row.SuggestedLimit = s.SuggestedLimit;
        row.MidAtSubmit = s.MidAtSubmit;
        row.BidAtSubmit = s.BidAtSubmit;
        row.Dte = s.Dte;
        row.Granularity = s.Granularity;
        row.EarningsInWindow = s.EarningsInWindow;
        row.EmpiricalAssignmentProb = s.EmpiricalAssignmentProb;
        row.EstPremium = s.EstPremium;
        row.Source = string.Equals(source, "bot", StringComparison.OrdinalIgnoreCase) ? "bot" : "desk";
    }

    private static void FlagAnomalyIfNeeded(TradeOutcome row)
    {
        if (!TradeOutcomeLabels.CountsForLearning(row.OutcomeLabel)) return;

        // Simple anomaly: assigned when model empirical assignment was very low, or vice versa.
        if (row.OutcomeLabel == TradeOutcomeLabels.Assigned
            && row.EmpiricalAssignmentProb is < 0.10)
        {
            row.IsAnomaly = true;
            row.AnomalyReason = "Assigned despite model empirical assignment < 10%.";
            return;
        }

        if (row.OutcomeLabel == TradeOutcomeLabels.ExpiredOtm
            && row.EmpiricalAssignmentProb is > 0.55)
        {
            row.IsAnomaly = true;
            row.AnomalyReason = "Expired OTM despite model empirical assignment > 55%.";
            return;
        }

        if (row.EstPremium is > 0 && row.PremiumCash is not null)
        {
            var estCash = (decimal)row.EstPremium.Value * 100m * (ParseDecimal(row.FilledQty) ?? 1);
            if (estCash > 0)
            {
                var ratio = row.PremiumCash.Value / estCash;
                if (ratio < 0.5m || ratio > 1.75m)
                {
                    row.IsAnomaly = true;
                    row.AnomalyReason =
                        $"Premium capture ratio {ratio:F2} vs estimate (outside 0.5–1.75).";
                }
            }
        }
    }

    private static decimal? ComputePremiumCash(string filledAvg, string filledQty, string side)
    {
        if (ParseDecimal(filledAvg) is not { } px) return null;
        if (ParseDecimal(filledQty) is not { } qty) return null;
        var credit = px * qty * 100m;
        // Sell-to-open: positive credit; buy: negative.
        return side.Equals("buy", StringComparison.OrdinalIgnoreCase) ? -credit : credit;
    }

    private static decimal? ParseDecimal(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : null;
    }

    private static string Csv(string? v)
    {
        if (string.IsNullOrEmpty(v)) return "";
        if (v.Contains(',') || v.Contains('"') || v.Contains('\n'))
            return $"\"{v.Replace("\"", "\"\"")}\"";
        return v;
    }

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

internal static class TradeOutcomeSnapshotExt
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static DecisionSnapshotDto? SnapshotFromStored(this TradeOutcome e)
    {
        if (string.IsNullOrEmpty(e.DecisionSnapshotJson)) return null;
        try
        {
            return JsonSerializer.Deserialize<DecisionSnapshotDto>(e.DecisionSnapshotJson, JsonOpts);
        }
        catch
        {
            return null;
        }
    }
}
