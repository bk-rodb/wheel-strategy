namespace WheelStrategy.Api.Models;

/// <summary>
/// Durable place/cancel intent for option orders. Broker remains SoT for status;
/// this row survives browser clears and powers resume / one-per-underlying locks.
/// </summary>
public class OrderJournalEntry
{
    public int Id { get; set; }

    /// <summary>Idempotency key sent to Alpaca — unique in the journal.</summary>
    public string ClientOrderId { get; set; } = string.Empty;

    public string? AlpacaOrderId { get; set; }

    public string Underlying { get; set; } = string.Empty;

    /// <summary>OSI / contract symbol.</summary>
    public string Symbol { get; set; } = string.Empty;

    public string Side { get; set; } = string.Empty;

    public string Qty { get; set; } = string.Empty;

    public string FilledQty { get; set; } = "0";

    public string? LimitPrice { get; set; }

    /// <summary>Desk state machine string (idle/submitting/working/…).</summary>
    public string DeskState { get; set; } = "submitting";

    public string? BrokerStatus { get; set; }

    /// <summary>desk | bot</summary>
    public string Source { get; set; } = "desk";

    public string? LastError { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? TerminalAt { get; set; }
}
