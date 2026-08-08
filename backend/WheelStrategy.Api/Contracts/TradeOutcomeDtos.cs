namespace WheelStrategy.Api.Contracts;

/// <summary>Frozen decision context at place time.</summary>
public record DecisionSnapshotDto(
    string Underlying,
    string OptionRight,
    string WheelSide,
    string? Level,
    decimal? ModelStrike,
    decimal? SnappedStrike,
    double? TargetDelta,
    string? HmmRegime,
    decimal? SpotAtSubmit,
    decimal? SuggestedLimit,
    decimal? MidAtSubmit,
    decimal? BidAtSubmit,
    int? Dte,
    string? Granularity,
    bool? EarningsInWindow,
    double? EmpiricalAssignmentProb,
    double? EstPremium,
    string? ContractSymbol = null);

public record TradeOutcomeDto(
    string ClientOrderId,
    string? AlpacaOrderId,
    string? WheelCycleId,
    string Underlying,
    string Symbol,
    string Side,
    string OptionRight,
    string WheelSide,
    string Qty,
    string FilledQty,
    string? LimitPrice,
    string? FilledAvgPrice,
    decimal? PremiumCash,
    decimal? Fees,
    decimal? RealizedPnL,
    string OutcomeLabel,
    string Source,
    DecisionSnapshotDto? Snapshot,
    string? Level,
    string? HmmRegime,
    string? CohortKey,
    bool IsAnomaly,
    string? AnomalyReason,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? FilledAt,
    DateTimeOffset? ResolvedAt);

public record TradeOutcomeListResponse(IReadOnlyList<TradeOutcomeDto> Items);

public record AttachSnapshotRequest(DecisionSnapshotDto Snapshot, string? Source = null);

public record ResolveOutcomeRequest(
    string? OutcomeLabel = null,
    decimal? RealizedPnL = null,
    string? WheelCycleId = null,
    bool? FromActivities = null);

public record CohortStatDto(
    string CohortKey,
    int SampleSize,
    double AssignmentRate,
    double? AvgPremiumCash,
    double? AvgEstPremium,
    double? PremiumCaptureRatio,
    double? ModelAssignmentProbAvg,
    IReadOnlyList<string> RecurringConditions);

public record AnomalyDto(
    string ClientOrderId,
    string Underlying,
    string OutcomeLabel,
    string? Reason,
    string? CohortKey,
    decimal? RealizedPnL,
    DateTimeOffset? ResolvedAt);

public record RetrospectiveSummaryDto(
    int TotalOutcomes,
    int ResolvedCount,
    int LearningSampleSize,
    double OverallAssignmentRate,
    decimal? TotalPremiumCash,
    decimal? TotalRealizedPnL,
    IReadOnlyList<CohortStatDto> Cohorts,
    IReadOnlyList<AnomalyDto> Anomalies,
    IReadOnlyList<WheelCycleSummaryDto> Cycles);

public record WheelCycleSummaryDto(
    string WheelCycleId,
    string Underlying,
    int LegCount,
    decimal? TotalPremiumCash,
    decimal? TotalRealizedPnL,
    IReadOnlyList<string> ClientOrderIds);

/// <summary>Experience decision head output — explainable priors from past fills.</summary>
public record ExperienceSignal(
    double? BiasDelta,
    double? WeightHint,
    double Confidence,
    IReadOnlyList<string> Reasons,
    int SampleSize,
    string? CohortKey);
