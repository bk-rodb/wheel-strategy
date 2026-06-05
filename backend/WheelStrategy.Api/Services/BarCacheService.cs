using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Models;

namespace WheelStrategy.Api.Services;

public interface IBarCacheService
{
    /// <summary>
    /// Return the full ordered (oldest→newest) bar series for a symbol/timeframe
    /// going back to <paramref name="start"/>, fetching from Alpaca and caching
    /// any bars not already stored. Pass <paramref name="forceRefresh"/> to re-pull.
    /// </summary>
    Task<IReadOnlyList<HistoricalBar>> GetSeriesAsync(
        string symbol, BarTimeframe timeframe, DateOnly start, bool forceRefresh, CancellationToken ct = default);
}

public class BarCacheService(WheelStrategyDbContext db, AlpacaMarketDataClient alpaca) : IBarCacheService
{
    private const string Adjustment = "all";

    public async Task<IReadOnlyList<HistoricalBar>> GetSeriesAsync(
        string symbol, BarTimeframe timeframe, DateOnly start, bool forceRefresh, CancellationToken ct = default)
    {
        symbol = symbol.ToUpperInvariant();

        var existing = await db.HistoricalBars
            .Where(b => b.Symbol == symbol && b.Timeframe == timeframe)
            .OrderBy(b => b.BarStart)
            .ToListAsync(ct);

        // Invalidate if the adjustment policy ever differs — mixed-adjustment rows
        // would corrupt the return series (e.g. NVDA's 2024 split).
        var staleAdjustment = existing.Any(b => b.Adjustment != Adjustment);
        if (forceRefresh || staleAdjustment)
        {
            db.HistoricalBars.RemoveRange(existing);
            await db.SaveChangesAsync(ct);
            existing.Clear();
        }

        // Incremental: only fetch from the last stored bar (or the requested start).
        var fetchFrom = existing.Count > 0
            ? existing[^1].BarStart           // refetch last (possibly-incomplete) bar + newer
            : start;

        var fetched = await alpaca.GetBarsAsync(symbol, timeframe, fetchFrom, ct);
        if (fetched.Count > 0)
        {
            var byDate = existing.ToDictionary(b => b.BarStart);
            foreach (var bar in fetched)
            {
                var barStart = DateOnly.FromDateTime(bar.Timestamp.UtcDateTime);
                if (byDate.TryGetValue(barStart, out var row))
                {
                    // Update the (possibly newly-completed) bar in place.
                    row.Open = bar.Open; row.High = bar.High; row.Low = bar.Low; row.Close = bar.Close;
                    row.Volume = bar.Volume; row.TradeCount = bar.TradeCount; row.VWAP = bar.Vwap;
                    row.FetchedAt = DateTime.UtcNow;
                }
                else
                {
                    var row2 = new HistoricalBar
                    {
                        Symbol = symbol,
                        Timeframe = timeframe,
                        BarStart = barStart,
                        Open = bar.Open, High = bar.High, Low = bar.Low, Close = bar.Close,
                        Volume = bar.Volume, TradeCount = bar.TradeCount, VWAP = bar.Vwap,
                        Adjustment = Adjustment,
                        FetchedAt = DateTime.UtcNow,
                    };
                    db.HistoricalBars.Add(row2);
                    byDate[barStart] = row2;
                    existing.Add(row2);
                }
            }
            await db.SaveChangesAsync(ct);
        }

        return existing
            .Where(b => b.BarStart >= start)
            .OrderBy(b => b.BarStart)
            .ToList();
    }
}
