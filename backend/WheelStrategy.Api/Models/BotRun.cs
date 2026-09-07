namespace WheelStrategy.Api.Models;

/// <summary>Append-only cycle outcome (skip / dry-run / place / block / …).</summary>
public class BotRun
{
    public int Id { get; set; }

    public DateTime At { get; set; }

    public string Symbol { get; set; } = string.Empty;

    public string TargetFriday { get; set; } = string.Empty;

    public string Side { get; set; } = string.Empty;

    public int Qty { get; set; }

    public bool DryRun { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Reason { get; set; }

    public string? ContractSymbol { get; set; }

    public double? Strike { get; set; }

    public double? SellLimit { get; set; }

    public string? OrderId { get; set; }

    public string? ClientOrderId { get; set; }

    public string? BlockersJson { get; set; }

    public string? WarningsJson { get; set; }
}
