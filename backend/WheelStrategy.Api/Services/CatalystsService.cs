using System.Net.Http.Json;
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
    private readonly ILogger<CatalystsService> _log;

    // Static FOMC / CPI / NFP calendar. Extend annually — when empty within the
    // macro window, a warning is returned so silence is not mistaken for "none".
    private static readonly CatalystEventDto[] MacroSchedule =
    [
        new("fomc-jul-2026", "macro", "market", "2026-07-29", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("jobs-aug-2026", "macro", "market", "2026-08-07", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-aug-2026", "macro", "market", "2026-08-12", "CPI release", "Consumer Price Index (Jul)", null, null, null, null),
        new("fomc-sep-2026", "macro", "market", "2026-09-16", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("jobs-sep-2026", "macro", "market", "2026-09-04", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-sep-2026", "macro", "market", "2026-09-11", "CPI release", "Consumer Price Index (Aug)", null, null, null, null),
        new("jobs-oct-2026", "macro", "market", "2026-10-02", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-oct-2026", "macro", "market", "2026-10-14", "CPI release", "Consumer Price Index (Sep)", null, null, null, null),
        new("fomc-nov-2026", "macro", "market", "2026-11-04", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("jobs-nov-2026", "macro", "market", "2026-11-06", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-nov-2026", "macro", "market", "2026-11-12", "CPI release", "Consumer Price Index (Oct)", null, null, null, null),
        new("jobs-dec-2026", "macro", "market", "2026-12-04", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-dec-2026", "macro", "market", "2026-12-10", "CPI release", "Consumer Price Index (Nov)", null, null, null, null),
        new("fomc-dec-2026", "macro", "market", "2026-12-16", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("jobs-jan-2027", "macro", "market", "2027-01-08", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-jan-2027", "macro", "market", "2027-01-13", "CPI release", "Consumer Price Index (Dec)", null, null, null, null),
        new("fomc-jan-2027", "macro", "market", "2027-01-27", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("jobs-feb-2027", "macro", "market", "2027-02-05", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-feb-2027", "macro", "market", "2027-02-10", "CPI release", "Consumer Price Index (Jan)", null, null, null, null),
        new("fomc-mar-2027", "macro", "market", "2027-03-17", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("jobs-mar-2027", "macro", "market", "2027-03-05", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-mar-2027", "macro", "market", "2027-03-10", "CPI release", "Consumer Price Index (Feb)", null, null, null, null),
        new("jobs-apr-2027", "macro", "market", "2027-04-02", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-apr-2027", "macro", "market", "2027-04-13", "CPI release", "Consumer Price Index (Mar)", null, null, null, null),
        new("fomc-may-2027", "macro", "market", "2027-05-05", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("jobs-may-2027", "macro", "market", "2027-05-07", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-may-2027", "macro", "market", "2027-05-12", "CPI release", "Consumer Price Index (Apr)", null, null, null, null),
        new("jobs-jun-2027", "macro", "market", "2027-06-04", "Nonfarm payrolls", "US employment report", null, null, null, null),
        new("cpi-jun-2027", "macro", "market", "2027-06-10", "CPI release", "Consumer Price Index (May)", null, null, null, null),
        new("fomc-jun-2027", "macro", "market", "2027-06-16", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("fomc-jul-2027", "macro", "market", "2027-07-28", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("fomc-sep-2027", "macro", "market", "2027-09-15", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("fomc-nov-2027", "macro", "market", "2027-11-03", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
        new("fomc-dec-2027", "macro", "market", "2027-12-15", "FOMC rate decision", "Federal Reserve policy announcement", null, null, null, null),
    ];

    public CatalystsService(
        HttpClient http,
        IOptions<FinnhubOptions> finnhub,
        ILogger<CatalystsService> log)
    {
        _http = http;
        _finnhub = finnhub.Value;
        _log = log;
    }

    public async Task<TickerCatalystsResult> GetCatalystsAsync(string symbol, CancellationToken ct = default)
    {
        var sym = symbol.Trim().ToUpperInvariant();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var horizon = today.AddDays(90);
        var events = new List<CatalystEventDto>();
        var warnings = new List<string>();

        if (!string.IsNullOrWhiteSpace(_finnhub.ApiKey))
        {
            try
            {
                events.AddRange(await FetchEarningsAsync(sym, today, horizon, ct));
                events.AddRange(await FetchDividendsAsync(sym, today, horizon, ct));
            }
            catch (HttpRequestException ex)
            {
                _log.LogWarning(ex, "Finnhub calendar request failed for {Symbol}", sym);
                warnings.Add("Earnings/dividend calendar unavailable — showing macro events only.");
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
            {
                _log.LogWarning(ex, "Finnhub calendar timed out for {Symbol}", sym);
                warnings.Add("Earnings/dividend calendar timed out — showing macro events only.");
            }
            catch (System.Text.Json.JsonException ex)
            {
                _log.LogWarning(ex, "Finnhub calendar response was not valid JSON for {Symbol}", sym);
                warnings.Add("Earnings/dividend calendar response was invalid — showing macro events only.");
            }
        }

        var macroTo = today.AddDays(14);
        var macro = UpcomingMacro(today, macroTo).ToList();
        if (macro.Count == 0 && MacroSchedule.Length > 0)
        {
            var last = MacroSchedule
                .Select(e => DateOnly.TryParse(e.Date, out var d) ? d : DateOnly.MinValue)
                .Max();
            if (last < today)
                warnings.Add($"Macro calendar ends {last:yyyy-MM-dd} — update CatalystsService.MacroSchedule.");
        }
        events.AddRange(macro);

        var nextFriday = NextFriday(today);
        for (var i = 0; i < events.Count; i++)
        {
            var e = events[i];
            if (e.Type == "earnings" && DateOnly.TryParse(e.Date, out var ed) && ed <= nextFriday)
            {
                events[i] = e with { ConflictsWithExpiry = true };
            }
        }

        return new TickerCatalystsResult(sym, events.OrderBy(e => e.Date).ToList(), warnings);
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
        // Token is on X-Finnhub-Token (configured on the typed HttpClient), never in the URL.
        var url =
            $"calendar/earnings?symbol={Uri.EscapeDataString(symbol)}" +
            $"&from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}";
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
            $"stock/dividend?symbol={Uri.EscapeDataString(symbol)}" +
            $"&from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}";
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
