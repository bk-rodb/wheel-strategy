namespace WheelStrategy.Api.Models;

public enum BarTimeframe { Week, Day }

/// <summary>
/// A cached OHLC bar for a symbol at a given timeframe, pulled from Alpaca and
/// stored so repeat analysis doesn't re-hit the market-data API. One row per
/// (Symbol, Timeframe, BarStart). Prices are split/dividend adjusted — the
/// adjustment policy used is recorded so a policy change invalidates the cache.
/// </summary>
public class HistoricalBar
{
    public int Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public BarTimeframe Timeframe { get; set; }

    /// <summary>Week-open (or day) date the bar is anchored to, in UTC calendar terms.</summary>
    public DateOnly BarStart { get; set; }

    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
    public long Volume { get; set; }
    public long TradeCount { get; set; }
    public decimal VWAP { get; set; }

    /// <summary>Alpaca adjustment used for this row, e.g. "all". Cache is invalidated if this changes.</summary>
    public string Adjustment { get; set; } = "all";

    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
}
