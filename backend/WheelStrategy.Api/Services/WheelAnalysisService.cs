using Microsoft.Extensions.Options;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Models;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Stats;

namespace WheelStrategy.Api.Services;

public record AnalysisRequest(
    string Symbol,
    int LookbackDays,
    int Dte,
    string Granularity,
    double? RiskFreeRate,
    bool Refresh);

public interface IWheelAnalysisService
{
    Task<WheelAnalysisResult> AnalyzeAsync(AnalysisRequest req, CancellationToken ct = default);
}

public class WheelAnalysisService(
    IBarCacheService bars,
    AlpacaMarketDataClient alpaca,
    IOptions<AnalysisOptions> analysisOptions) : IWheelAnalysisService
{
    private readonly AnalysisOptions _opts = analysisOptions.Value;

    public async Task<WheelAnalysisResult> AnalyzeAsync(AnalysisRequest req, CancellationToken ct = default)
    {
        var symbol = req.Symbol.ToUpperInvariant();
        var warnings = new List<string>();

        var weekly = req.Granularity.Equals("daily", StringComparison.OrdinalIgnoreCase) ? false : true;
        var timeframe = weekly ? BarTimeframe.Week : BarTimeframe.Day;
        var periodsPerYear = weekly ? 52.0 : 252.0;
        // Horizon in bar-periods matching the option's days-to-expiration.
        var horizon = weekly
            ? Math.Max(1, (int)Math.Round(req.Dte / 7.0))
            : Math.Max(1, (int)Math.Round(req.Dte * 5.0 / 7.0));

        var r = req.RiskFreeRate ?? _opts.RiskFreeRate;
        var t = req.Dte / 365.0;
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-req.LookbackDays));

        var series = await bars.GetSeriesAsync(symbol, timeframe, start, req.Refresh, ct);

        // Anchor spot to the live latest price; fall back to the last cached close.
        decimal spot;
        DateTimeOffset asOf;
        var latest = await alpaca.GetLatestPriceAsync(symbol, ct);
        if (latest is { } l) { spot = l.price; asOf = l.asOf; }
        else if (series.Count > 0) { spot = series[^1].Close; asOf = DateTime.UtcNow; }
        else
        {
            warnings.Add("No price data available for symbol.");
            return Empty(symbol, 0m, DateTimeOffset.UtcNow, req, horizon, weekly, 0, 0, r, warnings);
        }

        warnings.Add("IEX feed: single-venue bars; OHLC may differ slightly from consolidated tape.");

        var closes = series.Select(b => (double)b.Close).ToList();

        // Realized volatility from period log returns.
        var logReturns = new List<double>(Math.Max(0, closes.Count - 1));
        for (int i = 1; i < closes.Count; i++)
            if (closes[i] > 0 && closes[i - 1] > 0) logReturns.Add(Math.Log(closes[i] / closes[i - 1]));
        var sigmaAnnual = StatMath.StdDev(logReturns) * Math.Sqrt(periodsPerYear);

        // Overlapping forward returns over the horizon.
        var fwd = new List<double>(Math.Max(0, closes.Count - horizon));
        for (int i = 0; i + horizon < closes.Count; i++)
            if (closes[i] > 0) fwd.Add(closes[i + horizon] / closes[i] - 1.0);

        if (fwd.Count < _opts.MinSamples)
        {
            warnings.Add($"Insufficient history: {fwd.Count} forward-return samples (< {_opts.MinSamples} required).");
            return Empty(symbol, spot, asOf, req, horizon, weekly, fwd.Count, sigmaAnnual, r, warnings);
        }

        warnings.Add("Forward-return windows overlap; empirical percentiles are indicative — Black-Scholes prob is the harder estimate.");

        var sorted = fwd.OrderBy(x => x).ToList();
        var s = (double)spot;

        var levels = new (string name, double prob)[]
        {
            ("safe", _opts.SafeProb),
            ("regular", _opts.RegularProb),
            ("risky", _opts.RiskyProb),
        };

        var puts = new List<StrikeSuggestion>();
        var calls = new List<StrikeSuggestion>();

        foreach (var (name, p) in levels)
        {
            // PUT: downside — strike below spot; lower-tail percentile p == target assignment prob.
            {
                var pctReturn = StatMath.Quantile(sorted, p);
                var strike = RoundStrike(s * (1 + pctReturn));
                var k = (double)strike;
                var empirical = StatMath.FractionBelow(fwd, k / s - 1.0);
                var bsProb = StatMath.PutAssignmentProb(s, k, t, r, sigmaAnnual);
                var premium = StatMath.PutPrice(s, k, t, r, sigmaAnnual);
                var annYield = k > 0 && req.Dte > 0 ? premium / k * (365.0 / req.Dte) : 0;
                puts.Add(new StrikeSuggestion(name, strike, k / s - 1.0,
                    Round(empirical), Round(bsProb), RoundMoney(premium), Round(annYield)));
            }
            // CALL: upside — strike above spot; upper-tail (1-p) percentile.
            {
                var pctReturn = StatMath.Quantile(sorted, 1 - p);
                var strike = RoundStrike(s * (1 + pctReturn));
                var k = (double)strike;
                var empirical = StatMath.FractionAbove(fwd, k / s - 1.0);
                var bsProb = StatMath.CallAssignmentProb(s, k, t, r, sigmaAnnual);
                var premium = StatMath.CallPrice(s, k, t, r, sigmaAnnual);
                var annYield = s > 0 && req.Dte > 0 ? premium / s * (365.0 / req.Dte) : 0;
                calls.Add(new StrikeSuggestion(name, strike, k / s - 1.0,
                    Round(empirical), Round(bsProb), RoundMoney(premium), Round(annYield)));
            }
        }

        return new WheelAnalysisResult(
            symbol, spot, asOf, req.LookbackDays, req.Dte, horizon,
            weekly ? "weekly" : "daily", fwd.Count, Round(sigmaAnnual), r,
            puts, calls, warnings);
    }

    private static WheelAnalysisResult Empty(
        string symbol, decimal spot, DateTimeOffset asOf, AnalysisRequest req,
        int horizon, bool weekly, int sampleCount, double sigma, double r, List<string> warnings)
        => new(symbol, spot, asOf, req.LookbackDays, req.Dte, horizon,
            weekly ? "weekly" : "daily", sampleCount, Round(sigma), r, null, null, warnings);

    /// <summary>Round to a sane option strike grid: $1 at/above $25, else $0.50.</summary>
    private static decimal RoundStrike(double price)
    {
        var grid = price >= 25 ? 1.0 : 0.5;
        return (decimal)(Math.Round(price / grid) * grid);
    }

    private static double Round(double x) => double.IsNaN(x) ? 0 : Math.Round(x, 4);
    private static decimal RoundMoney(double x) => double.IsNaN(x) ? 0m : Math.Round((decimal)x, 2);
}
