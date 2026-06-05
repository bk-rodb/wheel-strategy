namespace WheelStrategy.Api.Models;

public enum BrokerType { AlpacaPaper, AlpacaLive, ETrade, InteractiveBrokers }

public class BrokerAccount
{
    public int Id { get; set; }
    public BrokerType BrokerType { get; set; }
    public string AccountNumber { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsPaper { get; set; }

    // Stored encrypted at rest — never plain text
    public string EncryptedApiKey { get; set; } = string.Empty;
    public string EncryptedApiSecret { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Position> Positions { get; set; } = [];
}
