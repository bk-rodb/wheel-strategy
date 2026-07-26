namespace WheelStrategy.Api.Contracts;

public record CatalystEventDto(
    string Id,
    string Type,
    string Scope,
    string Date,
    string Title,
    string? Detail,
    string? Timing,
    bool? ConflictsWithExpiry,
    double? YieldPct,
    string? SplitRatio);

/// <param name="Warnings">
/// Soft degradations (e.g. Finnhub unavailable). Empty means symbol calendars
/// were fetched successfully or no key is configured — not "provider down".
/// </param>
public record TickerCatalystsResult(
    string Symbol,
    IReadOnlyList<CatalystEventDto> Events,
    IReadOnlyList<string> Warnings);
