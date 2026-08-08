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
    IExperiencePriorService experience,
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
        var horizon = weekly
            ? Math.Max(1, (int)Math.Round(req.Dte / 7.0))
            : Math.Max(1, (int)Math.Round(req.Dte * 5.0 / 7.0));

        var r = req.RiskFreeRate ?? _opts.RiskFreeRate;
        var t = req.Dte / 365.0;
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-req.LookbackDays));

        var series = await bars.GetSeriesAsync(symbol, timeframe, start, req.Refresh, ct);

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
            return Empty(symbol, 0m, DateTimeOffset.UtcNow, req, horizon, weekly, 0, null, r, null, null, null, null, warnings);
        }

        warnings.Add("IEX feed: single-venue bars; OHLC may differ slightly from consolidated tape.");

        var closes = series.Select(b => (double)b.Close).ToList();

        var logReturns = new List<double>(Math.Max(0, closes.Count - 1));
        for (int i = 1; i < closes.Count; i++)
            if (closes[i] > 0 && closes[i - 1] > 0) logReturns.Add(Math.Log(closes[i] / closes[i - 1]));
        var sigmaAnnual = logReturns.Count >= 2
            ? StatMath.StdDev(logReturns) * Math.Sqrt(periodsPerYear)
            : double.NaN;

        var fwd = new List<double>(Math.Max(0, closes.Count - horizon));
        for (int i = 0; i + horizon < closes.Count; i++)
            if (closes[i] > 0) fwd.Add(closes[i + horizon] / closes[i] - 1.0);

        if (fwd.Count < _opts.MinSamples)
        {
            warnings.Add($"Insufficient history: {fwd.Count} forward-return samples (< {_opts.MinSamples} required).");
            return Empty(symbol, spot, asOf, req, horizon, weekly, fwd.Count, RoundVol(sigmaAnnual), r, null, null, null, null, warnings);
        }

        warnings.Add("Strike levels use |delta| rule-of-thumb (conservative 0.20 / balanced 0.30 / aggressive 0.40), widened by ATR floors and nudged by HMM regime.");
        warnings.Add("Forward-return windows overlap; empirical assignment is a cross-check — Black-Scholes delta/prob is the primary selector.");
        warnings.Add(
            $"Overlapping windows: effective independent sample size is roughly {fwd.Count / horizon} " +
            $"(sampleCount {fwd.Count} / horizon {horizon}), not {fwd.Count}.");
        warnings.Add("Premiums use realized volatility; listed options typically trade at higher implied vol.");
        warnings.Add("Black-Scholes assignment uses risk-neutral probabilities; empirical frequencies reflect the stock's own history.");
        warnings.Add("CSP annualized yield uses strike as collateral; CC yield uses spot — yields are not directly comparable.");

        var atr = await ComputeAtrMetricsAsync(symbol, start, (double)spot, req.Refresh, ct);
        var hmm = FitHmmRegime(series, horizon, warnings);

        var putExp = await experience.GetSignalAsync(
            symbol, "put", "regular", hmm?.CurrentRegime, req.Dte, earningsInWindow: null, ct);
        var callExp = await experience.GetSignalAsync(
            symbol, "call", "regular", hmm?.CurrentRegime, req.Dte, earningsInWindow: null, ct);
        AddExperienceWarnings(putExp, callExp, warnings);

        var sorted = fwd.OrderBy(x => x).ToList();
        var s = (double)spot;

        var levels = new (string name, double targetDelta, double atrMultiple)[]
        {
            ("safe", _opts.SafeDelta, _opts.SafeAtrMultiple),
            ("regular", _opts.RegularDelta, _opts.RegularAtrMultiple),
            ("risky", _opts.RiskyDelta, _opts.RiskyAtrMultiple),
        };

        var puts = new List<StrikeSuggestion>();
        var calls = new List<StrikeSuggestion>();

        foreach (var (name, targetDelta, atrMultiple) in levels)
        {
            var putDelta = EffectiveDelta(targetDelta, isPut: true, hmm, putExp);
            var callDelta = EffectiveDelta(targetDelta, isPut: false, hmm, callExp);

            puts.Add(BuildPutSuggestion(name, s, putDelta, targetDelta, atrMultiple, atr, t, r, sigmaAnnual, fwd, req.Dte));
            calls.Add(BuildCallSuggestion(name, s, callDelta, targetDelta, atrMultiple, atr, t, r, sigmaAnnual, fwd, req.Dte));
        }

        AddAtrReviewWarnings(puts, calls, atr, warnings);
        AddHmmReviewWarnings(puts, calls, hmm, warnings);

        return new WheelAnalysisResult(
            symbol, spot, asOf, req.LookbackDays, req.Dte, horizon,
            weekly ? "weekly" : "daily", fwd.Count, RoundVol(sigmaAnnual), r,
            atr, hmm, putExp, callExp, puts, calls, warnings);
    }

    private async Task<AtrMetrics?> ComputeAtrMetricsAsync(
        string symbol, DateOnly start, double spot, bool refresh, CancellationToken ct)
    {
        if (spot <= 0) return null;
        var daily = await bars.GetSeriesAsync(symbol, BarTimeframe.Day, start, refresh, ct);
        if (daily.Count < 22) return null;

        var highs = daily.Select(b => (double)b.High).ToList();
        var lows = daily.Select(b => (double)b.Low).ToList();
        var closes = daily.Select(b => (double)b.Close).ToList();

        double Pct(int period)
        {
            var atr = StatMath.Atr(highs, lows, closes, period);
            return double.IsFinite(atr) && atr > 0 ? atr / spot : double.NaN;
        }

        return new AtrMetrics(RoundProb(Pct(7)), RoundProb(Pct(14)), RoundProb(Pct(21)));
    }

    private HmmRegimeContext? FitHmmRegime(IReadOnlyList<HistoricalBar> series, int horizon, List<string> warnings)
    {
        var logReturns = new List<double>(Math.Max(0, series.Count - 1));
        for (var i = 1; i < series.Count; i++)
        {
            var prev = (double)series[i - 1].Close;
            var curr = (double)series[i].Close;
            if (prev > 0 && curr > 0) logReturns.Add(Math.Log(curr / prev));
        }

        if (logReturns.Count < _opts.MinSamples) return null;

        GaussianHmm.FitResult fit;
        try
        {
            fit = GaussianHmm.Fit(logReturns);
        }
        catch (Exception ex)
        {
            warnings.Add($"HMM fit skipped for strike review: {ex.Message}");
            return null;
        }

        var model = fit.Model;
        var current = fit.StateProbs[^1];
        var currentRegime = GaussianHmm.StateLabels[ArgMax(current)];

        var terminal = GaussianHmm.ForecastStateProbs(model, current, horizon);
        var cumLog = GaussianHmm.ForecastCumulativeLogReturn(model, current, horizon);
        var expectedPct = double.IsFinite(cumLog) ? (Math.Exp(cumLog) - 1.0) * 100.0 : double.NaN;

        return new HmmRegimeContext(
            currentRegime,
            RoundProb(terminal[0]) ?? 0,
            RoundProb(terminal[2]) ?? 0,
            RoundProb(expectedPct));
    }

    private double EffectiveDelta(
        double targetDelta, bool isPut, HmmRegimeContext? hmm, ExperienceSignal? experience)
    {
        var delta = targetDelta;
        if (hmm is not null)
        {
            var adjust = hmm.CurrentRegime switch
            {
                "bear" => _opts.HmmBearDeltaAdjust,
                "bull" => isPut ? _opts.HmmBullPutDeltaAdjust : _opts.HmmBullCallDeltaAdjust,
                _ => 0.0,
            };
            delta += adjust;
        }

        if (_opts.ExperienceApplyBias
            && experience?.BiasDelta is { } bias
            && experience.SampleSize >= _opts.ExperienceMinSamples
            && experience.Confidence >= 0.25)
        {
            delta += bias;
        }

        return Math.Clamp(delta, 0.10, 0.50);
    }

    private static void AddExperienceWarnings(
        ExperienceSignal putExp, ExperienceSignal callExp, List<string> warnings)
    {
        foreach (var reason in putExp.Reasons.Take(3))
            warnings.Add($"Experience (put): {reason}");
        foreach (var reason in callExp.Reasons.Take(2))
            warnings.Add($"Experience (call): {reason}");
    }

    private static StrikeSuggestion BuildPutSuggestion(
        string name, double s, double effectiveDelta, double targetDelta, double atrMultiple,
        AtrMetrics? atr, double t, double r, double sigma, IReadOnlyList<double> fwd, int dte)
    {
        var rawStrike = StatMath.StrikeForPutAbsDelta(s, effectiveDelta, t, r, sigma);
        var strike = ApplyAtrFloorPut(s, rawStrike, atr, atrMultiple);
        var k = (double)strike;
        var bsDelta = StatMath.PutDelta(s, k, t, r, sigma);
        var empirical = StatMath.FractionBelow(fwd, k / s - 1.0);
        var bsProb = StatMath.PutAssignmentProb(s, k, t, r, sigma);
        var premium = StatMath.PutPrice(s, k, t, r, sigma);
        var annYield = k > 0 && dte > 0 ? premium / k * (365.0 / dte) : double.NaN;
        return new StrikeSuggestion(name, strike, PctFromSpot(s, k),
            RoundProb(targetDelta), RoundProb(Math.Abs(bsDelta)), DistanceInAtr14(s, k, atr),
            RoundProb(empirical), RoundProb(bsProb), RoundMoney(premium), RoundProb(annYield));
    }

    private static StrikeSuggestion BuildCallSuggestion(
        string name, double s, double effectiveDelta, double targetDelta, double atrMultiple,
        AtrMetrics? atr, double t, double r, double sigma, IReadOnlyList<double> fwd, int dte)
    {
        var rawStrike = StatMath.StrikeForCallDelta(s, effectiveDelta, t, r, sigma);
        var strike = ApplyAtrFloorCall(s, rawStrike, atr, atrMultiple);
        var k = (double)strike;
        var bsDelta = StatMath.CallDelta(s, k, t, r, sigma);
        var empirical = StatMath.FractionAbove(fwd, k / s - 1.0);
        var bsProb = StatMath.CallAssignmentProb(s, k, t, r, sigma);
        var premium = StatMath.CallPrice(s, k, t, r, sigma);
        var annYield = s > 0 && dte > 0 ? premium / s * (365.0 / dte) : double.NaN;
        return new StrikeSuggestion(name, strike, PctFromSpot(s, k),
            RoundProb(targetDelta), RoundProb(bsDelta), DistanceInAtr14(s, k, atr),
            RoundProb(empirical), RoundProb(bsProb), RoundMoney(premium), RoundProb(annYield));
    }

    /// <summary>Widen put strike (lower K) when delta strike is inside the ATR floor.</summary>
    private static decimal ApplyAtrFloorPut(double spot, double deltaStrike, AtrMetrics? atr, double atrMultiple)
    {
        if (atr?.Atr14Pct is not double atr14 || atr14 <= 0) return RoundStrike(deltaStrike);
        var floorOtm = atr14 * atrMultiple;
        var floorStrike = spot * (1.0 - floorOtm);
        return RoundStrike(Math.Min(deltaStrike, floorStrike));
    }

    /// <summary>Widen call strike (higher K) when delta strike is inside the ATR floor.</summary>
    private static decimal ApplyAtrFloorCall(double spot, double deltaStrike, AtrMetrics? atr, double atrMultiple)
    {
        if (atr?.Atr14Pct is not double atr14 || atr14 <= 0) return RoundStrike(deltaStrike);
        var floorOtm = atr14 * atrMultiple;
        var floorStrike = spot * (1.0 + floorOtm);
        return RoundStrike(Math.Max(deltaStrike, floorStrike));
    }

    private static double? DistanceInAtr14(double spot, double strike, AtrMetrics? atr)
    {
        if (atr?.Atr14Pct is not double atr14 || atr14 <= 0 || spot <= 0) return null;
        var otm = Math.Abs(strike / spot - 1.0);
        return RoundProb(otm / atr14);
    }

    private static void AddAtrReviewWarnings(
        IReadOnlyList<StrikeSuggestion> puts, IReadOnlyList<StrikeSuggestion> calls,
        AtrMetrics? atr, List<string> warnings)
    {
        if (atr?.Atr14Pct is not { } atr14) return;
        foreach (var p in puts)
        {
            if (p.DistanceAtr14 is { } d && d < 1.0)
                warnings.Add($"PUT {p.Level}: strike only {d:F1}× ATR14 OTM — ATR review widened from pure delta target.");
        }
        foreach (var c in calls)
        {
            if (c.DistanceAtr14 is { } d && d < 1.0)
                warnings.Add($"CALL {c.Level}: strike only {d:F1}× ATR14 OTM — ATR review widened from pure delta target.");
        }
        warnings.Add($"ATR review: 7d {FmtPct(atr.Atr7Pct)}, 14d {FmtPct(atr.Atr14Pct)}, 21d {FmtPct(atr.Atr21Pct)} of spot.");
    }

    private static void AddHmmReviewWarnings(
        IReadOnlyList<StrikeSuggestion> puts, IReadOnlyList<StrikeSuggestion> calls,
        HmmRegimeContext? hmm, List<string> warnings)
    {
        if (hmm is null) return;
        warnings.Add(
            $"HMM regime: {hmm.CurrentRegime} (bear {hmm.BearProb:P0}, bull {hmm.BullProb:P0}); " +
            $"~{hmm.ExpectedReturnPctAtDte:F1}% expected over horizon — delta targets nudged accordingly.");
        if (hmm.CurrentRegime == "bear")
            warnings.Add("Bear regime: put/call deltas reduced — strikes pushed further OTM for safety.");
        else if (hmm.CurrentRegime == "bull")
            warnings.Add("Bull regime: put delta raised (closer strike), call delta lowered (further OTM).");
    }

    private static string FmtPct(double? x) => x is { } v ? $"{v * 100:F1}%" : "—";

    private static WheelAnalysisResult Empty(
        string symbol, decimal spot, DateTimeOffset asOf, AnalysisRequest req,
        int horizon, bool weekly, int sampleCount, double? sigma, double r,
        AtrMetrics? atr, HmmRegimeContext? hmm,
        ExperienceSignal? putExp, ExperienceSignal? callExp, List<string> warnings)
        => new(symbol, spot, asOf, req.LookbackDays, req.Dte, horizon,
            weekly ? "weekly" : "daily", sampleCount, sigma, r, atr, hmm,
            putExp, callExp, null, null, warnings);

    private static int ArgMax(IReadOnlyList<double> xs)
    {
        var best = 0;
        for (var i = 1; i < xs.Count; i++)
            if (xs[i] > xs[best]) best = i;
        return best;
    }

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
