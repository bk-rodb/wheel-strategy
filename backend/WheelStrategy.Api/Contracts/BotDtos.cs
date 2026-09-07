namespace WheelStrategy.Api.Contracts;

public record BotSettingsDto(
    IReadOnlyList<string> Symbols,
    string Level,
    bool DryRun,
    bool Paused,
    DateTimeOffset UpdatedAt);

public record BotLastCycleDto(
    string Symbol,
    string TargetFriday,
    string ClientOrderId,
    DateTimeOffset At,
    string Status,
    int RetryIndex);

public record BotConfigResponse(
    BotSettingsDto Settings,
    IReadOnlyList<BotLastCycleDto> LastCycles);

public record UpdateBotSettingsRequest(
    IReadOnlyList<string>? Symbols,
    string? Level,
    bool? DryRun,
    bool? Paused);

public record BotRunDto(
    DateTimeOffset At,
    string Symbol,
    string TargetFriday,
    string Side,
    int Qty,
    bool DryRun,
    string Status,
    string? Reason,
    string? ContractSymbol,
    double? Strike,
    double? SellLimit,
    string? OrderId,
    string? ClientOrderId,
    IReadOnlyList<string>? Blockers,
    IReadOnlyList<string>? Warnings);

public record BotRunListResponse(IReadOnlyList<BotRunDto> Runs);

public record CreateBotRunRequest(
    DateTimeOffset At,
    string Symbol,
    string TargetFriday,
    string Side,
    int Qty,
    bool DryRun,
    string Status,
    string? Reason,
    string? ContractSymbol,
    double? Strike,
    double? SellLimit,
    string? OrderId,
    string? ClientOrderId,
    IReadOnlyList<string>? Blockers,
    IReadOnlyList<string>? Warnings);

public record UpsertBotLastCycleRequest(
    string Symbol,
    string TargetFriday,
    string ClientOrderId,
    DateTimeOffset At,
    string Status,
    int? RetryIndex);
