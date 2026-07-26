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

    /// <summary>Target assignment probabilities mapped to each level.</summary>
    public double SafeProb { get; set; } = 0.15;
    public double RegularProb { get; set; } = 0.30;
    public double RiskyProb { get; set; } = 0.45;

    /// <summary>Minimum forward-return samples required before suggestions are produced.</summary>
    public int MinSamples { get; set; } = 20;
}
