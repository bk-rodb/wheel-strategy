using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Models;
using WheelStrategy.Api.Options;

namespace WheelStrategy.Api.Alpaca;

/// <summary>
/// Thin typed HttpClient over Alpaca's market-data REST API. Mirrors the
/// frontend's hand-rolled client (src/api/alpacaClient.ts), including the
/// deliberate omission of a Content-Type header on GETs.
/// </summary>
public class AlpacaMarketDataClient(HttpClient http, IOptions<AlpacaOptions> options)
{
    private readonly AlpacaOptions _opts = options.Value;

    private static string TimeframeParam(BarTimeframe tf) => tf switch
    {
        BarTimeframe.Week => "1Week",
        BarTimeframe.Day => "1Day",
        _ => "1Week",
    };

    /// <summary>
    /// Fetch adjusted OHLC bars for one symbol from <paramref name="start"/> onward,
    /// following next_page_token pagination. Returns oldest→newest.
    /// </summary>
    public async Task<List<AlpacaBarDto>> GetBarsAsync(
        string symbol, BarTimeframe timeframe, DateOnly start, CancellationToken ct = default)
    {
        var bars = new List<AlpacaBarDto>();
        string? pageToken = null;

        do
        {
            var url = $"{_opts.DataBaseUrl}/v2/stocks/bars"
                + $"?symbols={Uri.EscapeDataString(symbol)}"
                + $"&timeframe={TimeframeParam(timeframe)}"
                + $"&start={start:yyyy-MM-dd}"
                + $"&limit=10000"
                + $"&adjustment=all"
                + $"&sort=asc"
                + $"&feed={Uri.EscapeDataString(_opts.Feed)}";
            if (pageToken is not null)
                url += $"&page_token={Uri.EscapeDataString(pageToken)}";

            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("APCA-API-KEY-ID", _opts.ApiKeyId);
            req.Headers.Add("APCA-API-SECRET-KEY", _opts.ApiSecretKey);

            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct);
                throw new HttpRequestException($"Alpaca bars {symbol} → {(int)res.StatusCode}: {body}");
            }

            var payload = await res.Content.ReadFromJsonAsync<AlpacaBarsResponseDto>(ct);
            if (payload?.Bars is not null && payload.Bars.TryGetValue(symbol, out var symBars) && symBars is not null)
                bars.AddRange(symBars);

            pageToken = payload?.NextPageToken;
        }
        while (!string.IsNullOrEmpty(pageToken));

        return bars;
    }

    /// <summary>Latest known price for a symbol (latest trade, else daily close).</summary>
    public async Task<(decimal price, DateTimeOffset asOf)?> GetLatestPriceAsync(
        string symbol, CancellationToken ct = default)
    {
        var url = $"{_opts.DataBaseUrl}/v2/stocks/snapshots"
            + $"?symbols={Uri.EscapeDataString(symbol)}"
            + $"&feed={Uri.EscapeDataString(_opts.Feed)}";

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("APCA-API-KEY-ID", _opts.ApiKeyId);
        req.Headers.Add("APCA-API-SECRET-KEY", _opts.ApiSecretKey);

        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;

        var payload = await res.Content.ReadFromJsonAsync<Dictionary<string, AlpacaSnapshotDto>>(ct);
        if (payload is null || !payload.TryGetValue(symbol, out var snap) || snap is null) return null;

        if (snap.LatestTrade is { Price: > 0 } t) return (t.Price, t.Timestamp);
        if (snap.DailyBar is { Close: > 0 } d) return (d.Close, d.Timestamp);
        return null;
    }
}
