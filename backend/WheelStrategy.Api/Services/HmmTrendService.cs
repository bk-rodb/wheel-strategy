using Microsoft.Extensions.Options;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Models;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Stats;

namespace WheelStrategy.Api.Services;

public record HmmTrendRequest(string Symbol, int LookbackDays, string Granularity, bool Refresh);

public interface IHmmTrendService
{
    Task<HmmTrendResult> AnalyzeAsync(HmmTrendRequest req, CancellationToken ct = default);
}

public class HmmTrendService(
    IBarCacheService bars,
    AlpacaMarketDataClient alpaca,
    IOptions<AnalysisOptions> analysisOptions) : IHmmTrendService
{
    private static readonly int[] ForecastHorizons = [5, 10, 20, 35];
    private readonly AnalysisOptions _opts = analysisOptions.Value;

    public async Task<HmmTrendResult> AnalyzeAsync(HmmTrendRequest req, CancellationToken ct = default)
    {
        var symbol = req.Symbol.ToUpperInvariant();
        var warnings = new List<string>();
        var weekly = !req.Granularity.Equals("daily", StringComparison.OrdinalIgnoreCase);
        var timeframe = weekly ? BarTimeframe.Week : BarTimeframe.Day;
        var periodsPerYear = weekly ? 52.0 : 252.0;
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-req.LookbackDays));

        var series = await bars.GetSeriesAsync(symbol, timeframe, start, req.Refresh, ct);

        decimal spot;
        DateTimeOffset asOf;
        var latest = await alpaca.GetLatestPriceAsync(symbol, ct);
        if (latest is { } l) { spot = l.price; asOf = l.asOf; }
        else if (series.Count > 0) { spot = series[^1].Close; asOf = DateTime.UtcNow; }
        else
        {
            warnings.Add("No price data available for symbol.");
            return Empty(symbol, 0m, DateTimeOffset.UtcNow, req, warnings);
        }

        var logReturns = new List<double>(Math.Max(0, series.Count - 1));
        for (var i = 1; i < series.Count; i++)
        {
            var prev = (double)series[i - 1].Close;
            var curr = (double)series[i].Close;
            if (prev > 0 && curr > 0)
                logReturns.Add(Math.Log(curr / prev));
        }

        if (logReturns.Count < _opts.MinSamples)
        {
            warnings.Add($"Insufficient history: {logReturns.Count} return samples (< {_opts.MinSamples} required).");
            return Empty(symbol, spot, asOf, req, warnings);
        }

        GaussianHmm.FitResult fit;
        try
        {
            fit = GaussianHmm.Fit(logReturns);
        }
        catch (Exception ex)
        {
            warnings.Add($"HMM fit failed: {ex.Message}");
            return Empty(symbol, spot, asOf, req, warnings);
        }

        var model = fit.Model;
        var current = fit.StateProbs[^1];
        var currentRegime = GaussianHmm.StateLabels[ArgMax(current)];

        var history = new List<HmmStateSnapshot>();
        for (var t = 0; t < fit.StateProbs.Length; t++)
        {
            var probs = fit.StateProbs[t];
            var barDate = series[t + 1].BarStart.ToString("yyyy-MM-dd");
            history.Add(new HmmStateSnapshot(barDate, probs, GaussianHmm.StateLabels[ArgMax(probs)]));
        }

        var forecast = new List<HmmForecastHorizon>();
        foreach (var days in ForecastHorizons)
        {
            var horizonPeriods = weekly
                ? Math.Max(1, (int)Math.Round(days / 7.0))
                : Math.Max(1, days);

            var stateProbs = GaussianHmm.ForecastStateProbs(model, current, horizonPeriods);
            var periodReturn = GaussianHmm.ExpectedPeriodReturn(model, stateProbs);
            var expectedPct = (Math.Exp(periodReturn * horizonPeriods) - 1.0) * 100.0;

            forecast.Add(new HmmForecastHorizon(
                Days: days,
                StateProbs: stateProbs,
                ExpectedReturnPct: expectedPct,
                BearProb: stateProbs[0],
                BullProb: stateProbs[2]));
        }

        var stateVols = model.Variances
            .Select(v => Math.Sqrt(v) * Math.Sqrt(periodsPerYear) * 100.0)
            .ToList();

        warnings.Add("HMM regimes are descriptive, not predictive — use as one input among many.");

        return new HmmTrendResult(
            Symbol: symbol,
            CurrentPrice: spot,
            AsOf: asOf,
            LookbackDays: req.LookbackDays,
            Granularity: weekly ? "weekly" : "daily",
            StateLabels: GaussianHmm.StateLabels,
            History: history,
            CurrentStateProbs: current,
            CurrentRegime: currentRegime,
            TransitionMatrix: model.Transition.Select(row => (IReadOnlyList<double>)row.ToList()).ToList(),
            Forecast: forecast,
            StateMeans: model.Means.Select(m => m * periodsPerYear * 100.0).ToList(),
            StateVols: stateVols,
            Warnings: warnings);
    }

    private static HmmTrendResult Empty(
        string symbol, decimal spot, DateTimeOffset asOf, HmmTrendRequest req, List<string> warnings) =>
        new(
            symbol,
            spot,
            asOf,
            req.LookbackDays,
            req.Granularity.Equals("daily", StringComparison.OrdinalIgnoreCase) ? "daily" : "weekly",
            GaussianHmm.StateLabels,
            Array.Empty<HmmStateSnapshot>(),
            Array.Empty<double>(),
            "unknown",
            Array.Empty<IReadOnlyList<double>>(),
            Array.Empty<HmmForecastHorizon>(),
            Array.Empty<double>(),
            Array.Empty<double>(),
            warnings);

    private static int ArgMax(IReadOnlyList<double> xs)
    {
        var best = 0;
        for (var i = 1; i < xs.Count; i++)
            if (xs[i] > xs[best]) best = i;
        return best;
    }
}
