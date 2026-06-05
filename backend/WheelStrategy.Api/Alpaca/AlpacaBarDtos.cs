using System.Text.Json.Serialization;

namespace WheelStrategy.Api.Alpaca;

/// <summary>One OHLC bar as returned by Alpaca's /v2/stocks/bars endpoint.</summary>
public class AlpacaBarDto
{
    [JsonPropertyName("t")] public DateTimeOffset Timestamp { get; set; }
    [JsonPropertyName("o")] public decimal Open { get; set; }
    [JsonPropertyName("h")] public decimal High { get; set; }
    [JsonPropertyName("l")] public decimal Low { get; set; }
    [JsonPropertyName("c")] public decimal Close { get; set; }
    [JsonPropertyName("v")] public long Volume { get; set; }
    [JsonPropertyName("n")] public long TradeCount { get; set; }
    [JsonPropertyName("vw")] public decimal Vwap { get; set; }
}

/// <summary>
/// Multi-symbol bars response: { "bars": { "NVDA": [ ... ] }, "next_page_token": null }.
/// </summary>
public class AlpacaBarsResponseDto
{
    [JsonPropertyName("bars")] public Dictionary<string, List<AlpacaBarDto>>? Bars { get; set; }
    [JsonPropertyName("next_page_token")] public string? NextPageToken { get; set; }
}

/// <summary>Snapshot subset used to anchor the current/last price.</summary>
public class AlpacaTradeDto
{
    [JsonPropertyName("p")] public decimal Price { get; set; }
    [JsonPropertyName("t")] public DateTimeOffset Timestamp { get; set; }
}

public class AlpacaSnapshotDto
{
    [JsonPropertyName("latestTrade")] public AlpacaTradeDto? LatestTrade { get; set; }
    [JsonPropertyName("dailyBar")] public AlpacaBarDto? DailyBar { get; set; }
    [JsonPropertyName("prevDailyBar")] public AlpacaBarDto? PrevDailyBar { get; set; }
}
