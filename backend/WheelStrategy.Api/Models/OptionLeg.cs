namespace WheelStrategy.Api.Models;

public enum OptionType { Put, Call }
public enum LegStatus { Open, Expired, Assigned, BoughtBack }

public class OptionLeg
{
    public int Id { get; set; }
    public int PositionId { get; set; }
    public Position Position { get; set; } = null!;

    public OptionType OptionType { get; set; }
    public decimal Strike { get; set; }
    public DateOnly Expiration { get; set; }
    public decimal PremiumReceived { get; set; }    // per share (multiply by 100 for total)
    public int Contracts { get; set; }
    public LegStatus Status { get; set; } = LegStatus.Open;

    // Filled in on close/expiry
    public decimal? ClosePrice { get; set; }
    public decimal? RealizedPnL { get; set; }

    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
