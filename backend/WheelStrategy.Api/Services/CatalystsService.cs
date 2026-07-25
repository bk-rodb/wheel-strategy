using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Options;

namespace WheelStrategy.Api.Services;

public interface ICatalystsService
{
    Task<TickerCatalystsResult> GetCatalystsAsync(string symbol, CancellationToken ct = default);
}

public sealed class CatalystsService : ICatalystsService
{
    private readonly HttpClient _http;
    private readonly FinnhubOptions _finnhub;

    private static readonly CatalystEventDto[] MacroSchedule =
    [
        new("fomc-jul-2026", "macro", "market", "2026-07-29", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("cpi-aug-2026", "macro", "market", "2026-08-12", "CPI release", "Consumer Price Index (Jul)", null, null, null, null),
        new("jobs-aug-2026", "macro", "market", "2026-08-07", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("fomc-sep-2026", "macro", "market", "2026-09-16", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
    ];

    public CatalystsService(HttpClient http, IOptions<FinnhubOptions> finnhub)
    {
        _http = http;
        _finnhub = finnhub.Value;
    }

    public async Task<TickerCatalystsResult> GetCatalystsAsync(string symbol, CancellationToken ct = default)
    {
        var sym = symbol.Trim().ToUpperInvariant();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var horizon = today.AddDays(90);
        var events = new List<CatalystEventDto>();

        if (!string.IsNullOrWhiteSpace(_finnhub.ApiKey))
        {
            try
            {
                events.AddRange(await FetchEarningsAsync(sym, today, horizon, ct));
                events.AddRange(await FetchDividendsAsync(sym, today, horizon, ct));
            }
            catch (HttpRequestException)
            {
                // Degrade to macro-only when Finnhub is unavailable.
            }
        }

        events.AddRange(UpcomingMacro(today, today.AddDays(14)));

        var nextFriday = NextFriday(today);
        for (var i = 0; i < events.Count; i++)
        {
            var e = events[i];
            if (e.Type == "earnings" && DateOnly.TryParse(e.Date, out var ed) && ed <= nextFriday)
            {
                events[i] = e with { ConflictsWithExpiry = true };
            }
        }

        return new TickerCatalystsResult(sym, events.OrderBy(e => e.Date).ToList());
    }

    private static IEnumerable<CatalystEventDto> UpcomingMacro(DateOnly from, DateOnly to) =>
        MacroSchedule.Where(e =>
            DateOnly.TryParse(e.Date, out var d) && d >= from && d <= to);

    private static DateOnly NextFriday(DateOnly from)
    {
        var add = ((int)DayOfWeek.Friday - (int)from.DayOfWeek + 7) % 7;
        return from.AddDays(add);
    }

    private async Task<IReadOnlyList<CatalystEventDto>> FetchEarningsAsync(
        string symbol, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var url =
            $"{_finnhub.BaseUrl}/calendar/earnings?symbol={Uri.EscapeDataString(symbol)}" +
            $"&from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}&token={_finnhub.ApiKey}";
        var doc = await _http.GetFromJsonAsync<FinnhubEarningsCalendar>(url, ct);
        if (doc?.EarningsCalendar == null) return [];

        return doc.EarningsCalendar
            .Where(e => !string.IsNullOrWhiteSpace(e.Date))
            .Select(e => new CatalystEventDto(
                Id: $"earn-{symbol}-{e.Date}",
                Type: "earnings",
                Scope: "symbol",
                Date: e.Date!,
                Title: $"Earnings ({e.Quarter ?? "Q?"})",
                Detail: e.EpsEstimate != null ? $"EPS est. {e.EpsEstimate:F2}" : null,
                Timing: NormalizeTiming(e.Hour),
                ConflictsWithExpiry: null,
                YieldPct: null,
                SplitRatio: null))
            .ToList();
    }

    private async Task<IReadOnlyList<CatalystEventDto>> FetchDividendsAsync(
        string symbol, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var url =
            $"{_finnhub.BaseUrl}/stock/dividend?symbol={Uri.EscapeDataString(symbol)}" +
            $"&from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}&token={_finnhub.ApiKey}";
        var rows = await _http.GetFromJsonAsync<List<FinnhubDividend>>(url, ct);
        if (rows == null) return [];

        return rows
            .Where(d => !string.IsNullOrWhiteSpace(d.ExDate))
            .Select(d => new CatalystEventDto(
                Id: $"div-{symbol}-{d.ExDate}",
                Type: "ex_dividend",
                Scope: "symbol",
                Date: d.ExDate!,
                Title: "Ex-dividend",
                Detail: d.Amount > 0 ? $"${d.Amount:F4}/share" : null,
                Timing: null,
                ConflictsWithExpiry: null,
                YieldPct: null,
                SplitRatio: null))
            .ToList();
    }

    private static string? NormalizeTiming(string? hour) =>
        hour?.ToLowerInvariant() switch
        {
            "bmo" or "before market open" => "bmo",
            "amc" or "after market close" => "amc",
            _ => null,
        };

    private sealed class FinnhubEarningsCalendar
    {
        [JsonPropertyName("earningsCalendar")]
        public List<FinnhubEarning>? EarningsCalendar { get; set; }
    }

    private sealed class FinnhubEarning
    {
        public string? Date { get; set; }
        public string? Quarter { get; set; }
        public double? EpsEstimate { get; set; }
        public string? Hour { get; set; }
    }

    private sealed class FinnhubDividend
    {
        public string? ExDate { get; set; }
        public double Amount { get; set; }
    }
}
