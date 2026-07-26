using System.Collections.Concurrent;
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

    private static readonly ConcurrentDictionary<string, SemaphoreSlim> SymbolLocks = new();
    private static readonly SemaphoreSlim CoverageTableLock = new(1, 1);
    private static int _coverageTableEnsured;

    public async Task<IReadOnlyList<HistoricalBar>> GetSeriesAsync(
        string symbol, BarTimeframe timeframe, DateOnly start, bool forceRefresh, CancellationToken ct = default)
    {
        symbol = symbol.ToUpperInvariant();
        await EnsureCoverageTableAsync(ct);

        var gate = SymbolLocks.GetOrAdd($"{symbol}:{timeframe}", _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            return await GetSeriesCoreAsync(symbol, timeframe, start, forceRefresh, ct);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<IReadOnlyList<HistoricalBar>> GetSeriesCoreAsync(
        string symbol, BarTimeframe timeframe, DateOnly start, bool forceRefresh, CancellationToken ct)
    {
        var existing = await db.HistoricalBars
            .Where(b => b.Symbol == symbol && b.Timeframe == timeframe)
            .OrderBy(b => b.BarStart)
            .ToListAsync(ct);

        var coverage = await LoadCoverageAsync(symbol, timeframe, ct);
        if (coverage is null && existing.Count > 0)
        {
            coverage = new BarCacheCoverage(
                existing[0].BarStart,
                existing[^1].BarStart,
                existing[0].BarStart,
                existing[0].Adjustment);
        }

        var staleAdjustment = existing.Any(b => b.Adjustment != Adjustment)
            || (coverage is not null && coverage.Adjustment != Adjustment);
        var replaceAll = forceRefresh || staleAdjustment;

        var coversStart = !replaceAll
            && coverage is not null
            && coverage.Adjustment == Adjustment
            && (coverage.CoveredFrom <= start || coverage.SearchedFrom <= start);

        var fetchFrom = replaceAll
            ? start
            : coversStart && existing.Count > 0
                ? existing[^1].BarStart
                : start;

        var fetched = await alpaca.GetBarsAsync(symbol, timeframe, fetchFrom, ct);

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        if (replaceAll)
        {
            var toRemove = await db.HistoricalBars
                .Where(b => b.Symbol == symbol && b.Timeframe == timeframe)
                .ToListAsync(ct);
            db.HistoricalBars.RemoveRange(toRemove);
            existing.Clear();
            coverage = null;
        }

        if (fetched.Count > 0)
        {
            MergeFetchedBars(symbol, timeframe, existing, fetched);
        }

        if (existing.Count > 0)
        {
            var earliest = existing[0].BarStart;
            var latest = existing[^1].BarStart;
            var searchedFrom = replaceAll
                ? start
                : fetchFrom == start
                    ? MinDate(coverage?.SearchedFrom ?? start, start)
                    : coverage?.SearchedFrom ?? earliest;

            coverage = new BarCacheCoverage(
                coverage is null ? earliest : MinDate(coverage.CoveredFrom, earliest),
                latest,
                searchedFrom,
                Adjustment);

            await UpsertCoverageAsync(symbol, timeframe, coverage, ct);
        }
        else if (replaceAll)
        {
            await DeleteCoverageAsync(symbol, timeframe, ct);
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return existing
            .Where(b => b.BarStart >= start)
            .OrderBy(b => b.BarStart)
            .ToList();
    }

    private void MergeFetchedBars(
        string symbol, BarTimeframe timeframe, List<HistoricalBar> existing, List<AlpacaBarDto> fetched)
    {
        var byDate = existing.ToDictionary(b => b.BarStart);
        foreach (var bar in fetched)
        {
            var barStart = DateOnly.FromDateTime(bar.Timestamp.UtcDateTime);
            if (byDate.TryGetValue(barStart, out var row))
            {
                row.Open = bar.Open;
                row.High = bar.High;
                row.Low = bar.Low;
                row.Close = bar.Close;
                row.Volume = bar.Volume;
                row.TradeCount = bar.TradeCount;
                row.VWAP = bar.Vwap;
                row.FetchedAt = DateTime.UtcNow;
            }
            else
            {
                var row2 = new HistoricalBar
                {
                    Symbol = symbol,
                    Timeframe = timeframe,
                    BarStart = barStart,
                    Open = bar.Open,
                    High = bar.High,
                    Low = bar.Low,
                    Close = bar.Close,
                    Volume = bar.Volume,
                    TradeCount = bar.TradeCount,
                    VWAP = bar.Vwap,
                    Adjustment = Adjustment,
                    FetchedAt = DateTime.UtcNow,
                };
                db.HistoricalBars.Add(row2);
                byDate[barStart] = row2;
                existing.Add(row2);
            }
        }

        existing.Sort((a, b) => a.BarStart.CompareTo(b.BarStart));
    }

    private async Task EnsureCoverageTableAsync(CancellationToken ct)
    {
        if (Volatile.Read(ref _coverageTableEnsured) == 1)
            return;

        await CoverageTableLock.WaitAsync(ct);
        try
        {
            if (_coverageTableEnsured == 1)
                return;

            await db.Database.ExecuteSqlRawAsync(
                """
                CREATE TABLE IF NOT EXISTS BarCacheCoverage (
                    Symbol TEXT NOT NULL,
                    Timeframe TEXT NOT NULL,
                    CoveredFrom TEXT NOT NULL,
                    CoveredThrough TEXT NOT NULL,
                    SearchedFrom TEXT NOT NULL,
                    Adjustment TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL,
                    PRIMARY KEY (Symbol, Timeframe)
                )
                """, ct);

            Volatile.Write(ref _coverageTableEnsured, 1);
        }
        finally
        {
            CoverageTableLock.Release();
        }
    }

    private async Task<BarCacheCoverage?> LoadCoverageAsync(
        string symbol, BarTimeframe timeframe, CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<CoverageRow>(
                """
                SELECT CoveredFrom, CoveredThrough, SearchedFrom, Adjustment
                FROM BarCacheCoverage
                WHERE Symbol = {0} AND Timeframe = {1}
                """,
                symbol,
                timeframe.ToString())
            .ToListAsync(ct);

        var row = rows.FirstOrDefault();
        if (row is null)
            return null;

        return new BarCacheCoverage(
            DateOnly.Parse(row.CoveredFrom),
            DateOnly.Parse(row.CoveredThrough),
            DateOnly.Parse(row.SearchedFrom),
            row.Adjustment);
    }

    private Task UpsertCoverageAsync(
        string symbol, BarTimeframe timeframe, BarCacheCoverage coverage, CancellationToken ct)
    {
        var now = DateTime.UtcNow.ToString("O");
        return db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO BarCacheCoverage
                (Symbol, Timeframe, CoveredFrom, CoveredThrough, SearchedFrom, Adjustment, UpdatedAt)
            VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6})
            ON CONFLICT(Symbol, Timeframe) DO UPDATE SET
                CoveredFrom = excluded.CoveredFrom,
                CoveredThrough = excluded.CoveredThrough,
                SearchedFrom = excluded.SearchedFrom,
                Adjustment = excluded.Adjustment,
                UpdatedAt = excluded.UpdatedAt
            """,
            symbol,
            timeframe.ToString(),
            coverage.CoveredFrom.ToString("yyyy-MM-dd"),
            coverage.CoveredThrough.ToString("yyyy-MM-dd"),
            coverage.SearchedFrom.ToString("yyyy-MM-dd"),
            coverage.Adjustment,
            now);
    }

    private Task DeleteCoverageAsync(string symbol, BarTimeframe timeframe, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync(
            "DELETE FROM BarCacheCoverage WHERE Symbol = {0} AND Timeframe = {1}",
            symbol,
            timeframe.ToString());

    private static DateOnly MinDate(DateOnly a, DateOnly b) =>
        a.ToDateTime(TimeOnly.MinValue) <= b.ToDateTime(TimeOnly.MinValue) ? a : b;

    private sealed record BarCacheCoverage(
        DateOnly CoveredFrom,
        DateOnly CoveredThrough,
        DateOnly SearchedFrom,
        string Adjustment);

    private sealed class CoverageRow
    {
        public string CoveredFrom { get; set; } = string.Empty;
        public string CoveredThrough { get; set; } = string.Empty;
        public string SearchedFrom { get; set; } = string.Empty;
        public string Adjustment { get; set; } = string.Empty;
    }
}
