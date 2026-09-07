namespace WheelStrategy.Api.Models;

/// <summary>Idempotency row for the latest Friday cycle of one symbol.</summary>
public class BotLastCycle
{
    public int Id { get; set; }

    public string Symbol { get; set; } = string.Empty;

    public string TargetFriday { get; set; } = string.Empty;

    public string ClientOrderId { get; set; } = string.Empty;

    public DateTime At { get; set; }

    public string Status { get; set; } = string.Empty;

    public int RetryIndex { get; set; }
}
