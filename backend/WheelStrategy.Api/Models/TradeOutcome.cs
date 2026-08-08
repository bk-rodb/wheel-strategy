namespace WheelStrategy.Api.Models;

/// <summary>
/// Closed-trade / leg outcome ledger: economics, terminal labels, and an immutable
/// decision snapshot. Separate from <see cref="OrderJournalEntry"/> (OMS intent).
/// </summary>
public class TradeOutcome
{
    public int Id { get; set; }

    /// <summary>Links to order journal / Alpaca client_order_id — unique.</summary>
    public string ClientOrderId { get; set; } = string.Empty;

    public string? AlpacaOrderId { get; set; }

    /// <summary>Optional CSP→stock→CC cycle id (Phase D).</summary>
    public string? WheelCycleId { get; set; }

    public string Underlying { get; set; } = string.Empty;

    /// <summary>OSI contract symbol.</summary>
    public string Symbol { get; set; } = string.Empty;

    /// <summary>Broker side (sell / buy).</summary>
    public string Side { get; set; } = string.Empty;

    /// <summary>put | call (from snapshot / OSI).</summary>
    public string OptionRight { get; set; } = string.Empty;

    /// <summary>csp | cc (wheel phase at submit).</summary>
    public string WheelSide { get; set; } = string.Empty;

    public string Qty { get; set; } = "0";

    public string FilledQty { get; set; } = "0";

    public string? LimitPrice { get; set; }

    public string? FilledAvgPrice { get; set; }

    /// <summary>Premium cash = filledAvg * 100 * filledQty (sell-to-open credit positive).</summary>
    public decimal? PremiumCash { get; set; }

    public decimal? Fees { get; set; }

    public decimal? RealizedPnL { get; set; }

    /// <summary>See <see cref="Orders.TradeOutcomeLabels"/>.</summary>
    public string OutcomeLabel { get; set; } = Orders.TradeOutcomeLabels.Pending;

    /// <summary>desk | bot</summary>
    public string Source { get; set; } = "desk";

    /// <summary>Immutable JSON decision snapshot; set once.</summary>
    public string? DecisionSnapshotJson { get; set; }

    // Denormalized cohort keys (from snapshot)
    public string? Level { get; set; }
    public decimal? ModelStrike { get; set; }
    public decimal? SnappedStrike { get; set; }
    public double? TargetDelta { get; set; }
    public string? HmmRegime { get; set; }
    public decimal? SpotAtSubmit { get; set; }
    public decimal? SuggestedLimit { get; set; }
    public decimal? MidAtSubmit { get; set; }
    public decimal? BidAtSubmit { get; set; }
    public int? Dte { get; set; }
    public string? Granularity { get; set; }
    public bool? EarningsInWindow { get; set; }
    public double? EmpiricalAssignmentProb { get; set; }
    public double? EstPremium { get; set; }

    public string? CohortKey { get; set; }

    public bool IsAnomaly { get; set; }

    public string? AnomalyReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? FilledAt { get; set; }

    public DateTime? ResolvedAt { get; set; }
}
