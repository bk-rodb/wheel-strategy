namespace WheelStrategy.Api.Models;

/// <summary>
/// Cached market data snapshot — populated by the background sync service.
/// Avoids hammering broker APIs on every page load.
/// </summary>
public class PriceSnapshot
{
    public int Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public decimal CurrentPrice { get; set; }
    public decimal PreviousClose { get; set; }
    public decimal DayOpen { get; set; }
    public decimal DayHigh { get; set; }
    public decimal DayLow { get; set; }
    public long Volume { get; set; }
    public long MarketCap { get; set; }
    public DateTime SnapshotAt { get; set; } = DateTime.UtcNow;
}
