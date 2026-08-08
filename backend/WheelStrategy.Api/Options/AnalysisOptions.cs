namespace WheelStrategy.Api.Options;

/// <summary>
/// Defaults and tunables for the wheel-strategy analysis. All overridable per
/// request via query params; these are the fallbacks.
/// </summary>
public class AnalysisOptions
{
    public const string SectionName = "Analysis";

    public int DefaultLookbackDays { get; set; } = 730;   // ~2 years
    public int DefaultDte { get; set; } = 35;

    /// <summary>Hard ceiling for lookbackDays query param (cost / overflow guard).</summary>
    public int MaxLookbackDays { get; set; } = 3650; // ~10 years

    /// <summary>Hard ceiling for dte query param.</summary>
    public int MaxDte { get; set; } = 730;

    public double RiskFreeRate { get; set; } = 0.045;

    /// <summary>Target |delta| rule-of-thumb per level (conservative / balanced / aggressive).</summary>
    public double SafeDelta { get; set; } = 0.20;
    public double RegularDelta { get; set; } = 0.30;
    public double RiskyDelta { get; set; } = 0.40;

    /// <summary>Minimum OTM distance as a multiple of ATR when widening delta strikes.</summary>
    public double SafeAtrMultiple { get; set; } = 1.5;
    public double RegularAtrMultiple { get; set; } = 1.0;
    public double RiskyAtrMultiple { get; set; } = 0.7;

    /// <summary>HMM regime nudge applied to target delta (bear → safer, bull → puts closer).</summary>
    public double HmmBearDeltaAdjust { get; set; } = -0.05;
    public double HmmBullPutDeltaAdjust { get; set; } = 0.05;
    public double HmmBullCallDeltaAdjust { get; set; } = -0.05;

    /// <summary>Minimum forward-return samples required before suggestions are produced.</summary>
    public int MinSamples { get; set; } = 20;
}
