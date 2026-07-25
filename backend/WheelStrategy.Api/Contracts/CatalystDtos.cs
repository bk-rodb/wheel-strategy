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

public record TickerCatalystsResult(
    string Symbol,
    IReadOnlyList<CatalystEventDto> Events);
