namespace WheelStrategy.Api.Orders;

/// <summary>Desk-state strings persisted on <see cref="Models.OrderJournalEntry"/>.</summary>
public static class JournalDeskStates
{
    public const string Submitting = "submitting";
    public const string OrphanCheck = "orphan_check";
    public const string AckPending = "ack_pending";
    public const string Working = "working";
    public const string CancelRequested = "cancel_requested";
    public const string CancelPending = "cancel_pending";
    public const string Filled = "filled";
    public const string PartialFilled = "partial_filled";
    public const string Canceled = "canceled";
    public const string Rejected = "rejected";
    public const string RejectedLocal = "rejected_local";
    public const string Blocked = "blocked";
    public const string Error = "error";
    public const string SubmitFailed = "submit_failed";

    private static readonly HashSet<string> Open = new(StringComparer.Ordinal)
    {
        Submitting,
        OrphanCheck,
        AckPending,
        Working,
        CancelRequested,
        CancelPending,
    };

    private static readonly HashSet<string> BrokerOpen = new(StringComparer.OrdinalIgnoreCase)
    {
        "new",
        "accepted",
        "pending_new",
        "accepted_for_bidding",
        "partially_filled",
        "pending_cancel",
        "pending_replace",
        "held",
        "stopped",
        "suspended",
        "calculated",
    };

    public static bool IsOpen(string deskState) => Open.Contains(deskState);

    public static bool IsBrokerOpen(string? brokerStatus) =>
        brokerStatus is not null && BrokerOpen.Contains(brokerStatus);

    public static string FromBrokerStatus(string? status, string qty, string filledQty)
    {
        if (string.IsNullOrEmpty(status)) return Working;

        if (string.Equals(status, "filled", StringComparison.OrdinalIgnoreCase))
            return Filled;

        if (string.Equals(status, "done_for_day", StringComparison.OrdinalIgnoreCase))
        {
            if (ParseQty(filledQty) >= ParseQty(qty) && ParseQty(qty) > 0)
                return Filled;
            if (ParseQty(filledQty) > 0)
                return PartialFilled;
            return Canceled;
        }

        if (string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase))
            return Rejected;

        if (string.Equals(status, "canceled", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "expired", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "replaced", StringComparison.OrdinalIgnoreCase))
        {
            if (ParseQty(filledQty) > 0) return PartialFilled;
            return Canceled;
        }

        if (string.Equals(status, "pending_cancel", StringComparison.OrdinalIgnoreCase))
            return CancelPending;

        if (string.Equals(status, "pending_new", StringComparison.OrdinalIgnoreCase))
            return AckPending;

        if (IsBrokerOpen(status)) return Working;

        return Working;
    }

    private static decimal ParseQty(string? raw) =>
        decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var v)
            ? v
            : 0m;
}
