namespace WheelStrategy.Api.Orders;

/// <summary>Terminal and working labels for <see cref="Models.TradeOutcome"/>.</summary>
public static class TradeOutcomeLabels
{
    public const string Pending = "pending";
    public const string FilledOpen = "filled_open";
    public const string ExpiredOtm = "expired_otm";
    public const string Assigned = "assigned";
    public const string BoughtToClose = "bought_to_close";
    public const string CanceledBeforeFill = "canceled_before_fill";
    public const string Unknown = "unknown";

    public static bool IsResolved(string label) =>
        label is ExpiredOtm or Assigned or BoughtToClose or CanceledBeforeFill;

    public static bool CountsForLearning(string label) =>
        label is ExpiredOtm or Assigned or BoughtToClose;
}
