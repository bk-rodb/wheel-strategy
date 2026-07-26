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
    IOptions<AnalysisOptions> analysisOptions,
    ILogger<WheelAnalysisService> log) : IWheelAnalysisService
{
    private readonly AnalysisOptions _opts = analysisOptions.Value;

    public async Task<WheelAnalysisResult> AnalyzeAsync(AnalysisRequest req, CancellationToken ct = default)
    {
        var symbol = req.Symbol.ToUpperInvariant();
        var warnings = new List<string>();
        log.LogDebug(
            "Wheel analysis {Symbol} lookback={Lookback} dte={Dte} granularity={Granularity}",
            symbol, req.LookbackDays, req.Dte, req.Granularity);

        var weekly = true;
        if (req.Granularity.Equals("daily", StringComparison.OrdinalIgnoreCase))
            weekly = false;
        else if (!req.Granularity.Equals("weekly", StringComparison.OrdinalIgnoreCase))
            warnings.Add($"Unrecognized granularity '{req.Granularity}'; defaulting to weekly.");

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
        else if (series.Count > 0)
        {
            var lastBar = series[^1];
            spot = lastBar.Close;
            asOf = new DateTimeOffset(lastBar.BarStart.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            warnings.Add("Spot price from cached bar close; asOf reflects last bar date, not a live quote.");
        }
        else
        {
            warnings.Add("No price data available for symbol.");
            return Empty(symbol, 0m, DateTimeOffset.UtcNow, req, horizon, weekly, 0, null, r, warnings);
        }

        warnings.Add("IEX feed: single-venue bars; OHLC may differ slightly from consolidated tape.");

        var closes = series.Select(b => (double)b.Close).ToList();

        // Realized volatility from period log returns.
        var logReturns = new List<double>(Math.Max(0, closes.Count - 1));
        for (int i = 1; i < closes.Count; i++)
            if (closes[i] > 0 && closes[i - 1] > 0) logReturns.Add(Math.Log(closes[i] / closes[i - 1]));
        var sigmaAnnual = logReturns.Count >= 2
            ? StatMath.StdDev(logReturns) * Math.Sqrt(periodsPerYear)
            : double.NaN;

        // Overlapping forward returns over the horizon.
        var fwd = new List<double>(Math.Max(0, closes.Count - horizon));
        for (int i = 0; i + horizon < closes.Count; i++)
            if (closes[i] > 0) fwd.Add(closes[i + horizon] / closes[i] - 1.0);

        if (fwd.Count < _opts.MinSamples)
        {
            warnings.Add($"Insufficient history: {fwd.Count} forward-return samples (< {_opts.MinSamples} required).");
            return Empty(symbol, spot, asOf, req, horizon, weekly, fwd.Count, RoundVol(sigmaAnnual), r, warnings);
        }

        warnings.Add("Forward-return windows overlap; empirical percentiles are indicative — Black-Scholes prob is the harder estimate.");
        warnings.Add(
            $"Overlapping windows: effective independent sample size is roughly {fwd.Count / horizon} " +
            $"(sampleCount {fwd.Count} / horizon {horizon}), not {fwd.Count}.");
        warnings.Add("Premiums use realized volatility; listed options typically trade at higher implied vol.");
        warnings.Add("Black-Scholes assignment uses risk-neutral probabilities; empirical frequencies reflect the stock's own history.");
        warnings.Add("CSP annualized yield uses strike as collateral; CC yield uses spot — yields are not directly comparable.");

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
                var annYield = k > 0 && req.Dte > 0 ? premium / k * (365.0 / req.Dte) : double.NaN;
                puts.Add(new StrikeSuggestion(name, strike, PctFromSpot(s, k),
                    RoundProb(empirical), RoundProb(bsProb), RoundMoney(premium), RoundProb(annYield)));
            }
            // CALL: upside — strike above spot; upper-tail (1-p) percentile.
            {
                var pctReturn = StatMath.Quantile(sorted, 1 - p);
                var strike = RoundStrike(s * (1 + pctReturn));
                var k = (double)strike;
                var empirical = StatMath.FractionAbove(fwd, k / s - 1.0);
                var bsProb = StatMath.CallAssignmentProb(s, k, t, r, sigmaAnnual);
                var premium = StatMath.CallPrice(s, k, t, r, sigmaAnnual);
                var annYield = s > 0 && req.Dte > 0 ? premium / s * (365.0 / req.Dte) : double.NaN;
                calls.Add(new StrikeSuggestion(name, strike, PctFromSpot(s, k),
                    RoundProb(empirical), RoundProb(bsProb), RoundMoney(premium), RoundProb(annYield)));
            }
        }

        return new WheelAnalysisResult(
            symbol, spot, asOf, req.LookbackDays, req.Dte, horizon,
            weekly ? "weekly" : "daily", fwd.Count, RoundVol(sigmaAnnual), r,
            puts, calls, warnings);
    }

    private static WheelAnalysisResult Empty(
        string symbol, decimal spot, DateTimeOffset asOf, AnalysisRequest req,
        int horizon, bool weekly, int sampleCount, double? sigma, double r, List<string> warnings)
        => new(symbol, spot, asOf, req.LookbackDays, req.Dte, horizon,
            weekly ? "weekly" : "daily", sampleCount, sigma, r, null, null, warnings);

    /// <summary>Round to a sane option strike grid: $1 at/above $25, else $0.50.</summary>
    private static decimal RoundStrike(double price)
    {
        var grid = price >= 25 ? 1.0 : 0.5;
        return (decimal)(Math.Round(price / grid, MidpointRounding.AwayFromZero) * grid);
    }

    private static double? PctFromSpot(double spot, double strike) =>
        spot > 0 && double.IsFinite(strike) ? strike / spot - 1.0 : null;

    private static double? RoundProb(double x) =>
        double.IsFinite(x) ? Math.Round(x, 4) : null;

    private static double? RoundVol(double x) =>
        double.IsFinite(x) && x >= 0 ? Math.Round(x, 4) : null;

    private static decimal? RoundMoney(double x) =>
        double.IsFinite(x) ? Math.Round((decimal)x, 2) : null;
}
