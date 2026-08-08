namespace WheelStrategy.Api.Contracts;

/// <summary>Wire shape for durable order-intent rows.</summary>
public record OrderJournalDto(
    string ClientOrderId,
    string? AlpacaOrderId,
    string Underlying,
    string Symbol,
    string Side,
    string Qty,
    string FilledQty,
    string? LimitPrice,
    string DeskState,
    string? BrokerStatus,
    string Source,
    string? LastError,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? TerminalAt);

public record OrderJournalListResponse(IReadOnlyList<OrderJournalDto> Entries);
