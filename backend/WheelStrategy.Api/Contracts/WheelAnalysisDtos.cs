namespace WheelStrategy.Api.Contracts;

public enum AnalysisLevel { Safe, Regular, Risky }

/// <summary>One strike recommendation for a given side (put/call) and risk level.</summary>
public record StrikeSuggestion(
    string Level,
    decimal Strike,
    double PctFromSpot,
    double EmpiricalAssignmentProb,
    double BlackScholesAssignmentProb,
    decimal EstPremium,
    double AnnualizedYield);

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
    double RealizedVolAnnual,
    double RiskFreeRate,
    IReadOnlyList<StrikeSuggestion>? Put,
    IReadOnlyList<StrikeSuggestion>? Call,
    IReadOnlyList<string> Warnings);
