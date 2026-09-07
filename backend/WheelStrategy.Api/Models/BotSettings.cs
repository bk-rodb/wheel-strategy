namespace WheelStrategy.Api.Models;

/// <summary>Singleton row (Id = 1) for desk-editable bot knobs.</summary>
public class BotSettings
{
    public int Id { get; set; } = 1;

    /// <summary>JSON string array of underlyings, e.g. ["NVDA","SPCX","RKLB"].</summary>
    public string SymbolsJson { get; set; } = """["NVDA","SPCX","RKLB"]""";

    public string Level { get; set; } = "regular";

    public bool DryRun { get; set; } = true;

    public bool Paused { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
