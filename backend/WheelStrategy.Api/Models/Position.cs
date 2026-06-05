namespace WheelStrategy.Api.Models;

public enum WheelPhase { CashSecuredPut, StockHolding, CoveredCall }

public class Position
{
    public int Id { get; set; }
    public int BrokerAccountId { get; set; }
    public BrokerAccount BrokerAccount { get; set; } = null!;

    public string Symbol { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Sector { get; set; } = string.Empty;
    public WheelPhase Phase { get; set; }

    public int Shares { get; set; }
    public decimal CostBasis { get; set; }        // per share
    public decimal CashDeployed { get; set; }
    public decimal PremiumCollectedTotal { get; set; }
    public decimal UnrealizedPnL { get; set; }    // refreshed on sync

    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public DateTime LastSyncedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OptionLeg> OptionLegs { get; set; } = [];
}
