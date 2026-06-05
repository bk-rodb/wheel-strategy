namespace WheelStrategy.Api.Models;

public class WatchlistItem
{
    public int Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
