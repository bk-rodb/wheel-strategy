namespace WheelStrategy.Api.Contracts;

public enum AnalysisLevel { Safe, Regular, Risky }

/// <summary>7/14/21-day ATR as a fraction of spot (e.g. 0.025 = 2.5%).</summary>
public record AtrMetrics(double? Atr7Pct, double? Atr14Pct, double? Atr21Pct);

/// <summary>HMM regime context at the option horizon — descriptive input for strike review.</summary>
public record HmmRegimeContext(
    string CurrentRegime,
    double BearProb,
    double BullProb,
    double? ExpectedReturnPctAtDte);

/// <summary>One strike recommendation for a given side (put/call) and risk level.</summary>
public record StrikeSuggestion(
    string Level,
    decimal Strike,
    double? PctFromSpot,
    double? TargetDelta,
    double? BlackScholesDelta,
    double? DistanceAtr14,
    double? EmpiricalAssignmentProb,
    double? BlackScholesAssignmentProb,
    decimal? EstPremium,
    double? AnnualizedYield);

/// <summary>Full analysis response for a symbol.</summary>
public record WheelAnalysisResult(
    string Symbol,
    decimal CurrentPrice,
    DateTimeOffset AsOf,
    int LookbackDays,
    int Dte,
    int HorizonPeriods,
    string Granularity,
    int SampleCount,
    double? RealizedVolAnnual,
    double RiskFreeRate,
    AtrMetrics? Atr,
    HmmRegimeContext? HmmRegime,
    IReadOnlyList<StrikeSuggestion>? Put,
    IReadOnlyList<StrikeSuggestion>? Call,
    IReadOnlyList<string> Warnings);
