using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Orders;

namespace WheelStrategy.Api.Services;

public interface IExperiencePriorService
{
    /// <summary>
    /// Build an ExperienceSignal for the given analysis context from resolved fills.
    /// Returns a zero-confidence empty signal when sample size is insufficient.
    /// </summary>
    Task<ExperienceSignal> GetSignalAsync(
        string symbol,
        string optionRight,
        string? level,
        string? hmmRegime,
        int dte,
        bool? earningsInWindow,
        CancellationToken ct = default);
}

public sealed class ExperiencePriorService(
    WheelStrategyDbContext db,
    IOptions<AnalysisOptions> analysisOptions) : IExperiencePriorService
{
    private readonly AnalysisOptions _opts = analysisOptions.Value;

    public async Task<ExperienceSignal> GetSignalAsync(
        string symbol,
        string optionRight,
        string? level,
        string? hmmRegime,
        int dte,
        bool? earningsInWindow,
        CancellationToken ct = default)
    {
        var right = optionRight.Trim().ToLowerInvariant();
        var cohortKey = ITradeOutcomeService.BuildCohortKey(
            right, level, hmmRegime, dte, earningsInWindow, underlying: null);

        var rows = await db.TradeOutcomes
            .Where(e => e.OutcomeLabel == TradeOutcomeLabels.ExpiredOtm
                        || e.OutcomeLabel == TradeOutcomeLabels.Assigned
                        || e.OutcomeLabel == TradeOutcomeLabels.BoughtToClose)
            .Where(e => e.OptionRight == right)
            .ToListAsync(ct);

        // Prefer ALL-underlying cohort matching keys; fall back to symbol-specific if enough.
        var allCohort = rows
            .Where(r => MatchesCohort(r, right, level, hmmRegime, dte, earningsInWindow))
            .ToList();

        var symbolCohort = allCohort
            .Where(r => string.Equals(r.Underlying, symbol, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var sample = symbolCohort.Count >= _opts.ExperienceMinSamples
            ? symbolCohort
            : allCohort;

        var n = sample.Count;
        if (n < _opts.ExperienceMinSamples)
        {
            return new ExperienceSignal(
                BiasDelta: null,
                WeightHint: null,
                Confidence: 0,
                Reasons: [$"Experience head idle: {n} resolved fills in cohort (need {_opts.ExperienceMinSamples})."],
                SampleSize: n,
                CohortKey: cohortKey);
        }

        var assigned = sample.Count(r => r.OutcomeLabel == TradeOutcomeLabels.Assigned);
        var assignRate = (double)assigned / n;
        var modelProb = sample
            .Where(r => r.EmpiricalAssignmentProb is not null)
            .Select(r => r.EmpiricalAssignmentProb!.Value)
            .DefaultIfEmpty(double.NaN)
            .Average();

        var reasons = new List<string>
        {
            $"Cohort n={n}: realized assignment {assignRate:P0}"
            + (double.IsFinite(modelProb) ? $" vs model avg {modelProb:P0}." : "."),
        };

        double? bias = null;
        double? weightHint = null;
        var confidence = Math.Clamp(n / 40.0, 0.25, 1.0);

        if (double.IsFinite(modelProb))
        {
            var error = assignRate - modelProb;
            // Assigned more than model → sell safer (more negative delta for puts/calls target |Δ|).
            if (error > _opts.ExperienceAssignmentErrorThreshold)
            {
                bias = -Math.Min(_opts.ExperienceMaxBiasDelta, error);
                reasons.Add(
                    $"Realized assignment exceeds model by {error:P0} → widen (biasΔ {bias:F3}).");
            }
            else if (error < -_opts.ExperienceAssignmentErrorThreshold)
            {
                bias = Math.Min(_opts.ExperienceMaxBiasDelta, -error);
                reasons.Add(
                    $"Realized assignment below model by {-error:P0} → allow tighter (biasΔ +{bias:F3}).");
            }
        }

        // Soft distrust Greeks when high-vol-like outcomes dominate (high assignment + bear labels).
        var bearShare = sample.Count(r =>
            string.Equals(r.HmmRegime, "bear", StringComparison.OrdinalIgnoreCase)) / (double)n;
        if (assignRate > 0.45 && bearShare > 0.4)
        {
            weightHint = _opts.ExperienceDistrustGreeksWeightHint;
            reasons.Add(
                $"High assignment ({assignRate:P0}) with bear-regime share {bearShare:P0} → weightHint {weightHint:F2} (distrust Greeks).");
        }

        if (bias is null && weightHint is null)
            reasons.Add("No material bias; cohort aligns with model within threshold.");

        // Cap confidence if anomalies dominate.
        var anomalyShare = sample.Count(r => r.IsAnomaly) / (double)n;
        if (anomalyShare > 0.25)
        {
            confidence *= 0.7;
            reasons.Add($"Anomaly share {anomalyShare:P0} — confidence reduced; anomalies do not move weights alone.");
        }

        return new ExperienceSignal(bias, weightHint, confidence, reasons, n, cohortKey);
    }

    private static bool MatchesCohort(
        Models.TradeOutcome r,
        string right,
        string? level,
        string? hmmRegime,
        int dte,
        bool? earningsInWindow)
    {
        if (!string.Equals(r.OptionRight, right, StringComparison.OrdinalIgnoreCase))
            return false;
        if (!string.IsNullOrEmpty(level)
            && !string.Equals(r.Level, level, StringComparison.OrdinalIgnoreCase))
            return false;
        if (!string.IsNullOrEmpty(hmmRegime)
            && !string.Equals(r.HmmRegime, hmmRegime, StringComparison.OrdinalIgnoreCase))
            return false;
        if (ITradeOutcomeService.DteBucket(r.Dte) != ITradeOutcomeService.DteBucket(dte))
            return false;
        var earn = earningsInWindow == true;
        if ((r.EarningsInWindow == true) != earn)
            return false;
        return true;
    }
}
