using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Data;
using WheelStrategy.Api.Models;

namespace WheelStrategy.Api.Services;

public interface IBotConfigService
{
    Task<BotConfigResponse> GetConfigAsync(CancellationToken ct = default);
    Task<(bool Ok, BotConfigResponse? Config, string? Error)> UpdateSettingsAsync(
        UpdateBotSettingsRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<BotRunDto>> ListRunsAsync(
        string? symbol, string? status, int limit, CancellationToken ct = default);
    Task<(bool Ok, BotRunDto? Run, string? Error)> AppendRunAsync(
        CreateBotRunRequest request, CancellationToken ct = default);
    Task<(bool Ok, BotLastCycleDto? Cycle, string? Error)> UpsertLastCycleAsync(
        UpsertBotLastCycleRequest request, CancellationToken ct = default);
    Task<int> ClearLastCycleAsync(string? symbol, CancellationToken ct = default);
}

public sealed class BotConfigService(WheelStrategyDbContext db) : IBotConfigService
{
    public const int MaxSymbols = 20;
    public static readonly string[] DefaultSymbols = ["NVDA", "SPCX", "RKLB"];
    public static readonly HashSet<string> AllowedLevels = new(StringComparer.OrdinalIgnoreCase)
    {
        "safe", "regular", "risky",
    };
    public static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "skipped", "dry_run", "placed", "filled", "canceled", "blocked", "error",
    };

    private static readonly Regex SymbolRe = new(@"^[A-Z][A-Z0-9.]{0,9}$", RegexOptions.Compiled);
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = null };

    public async Task<BotConfigResponse> GetConfigAsync(CancellationToken ct = default)
    {
        var settings = await EnsureSettingsAsync(ct);
        var cycles = await db.BotLastCycles.AsNoTracking()
            .OrderBy(c => c.Symbol)
            .ToListAsync(ct);
        return new BotConfigResponse(ToSettingsDto(settings), cycles.Select(ToLastCycleDto).ToList());
    }

    public async Task<(bool Ok, BotConfigResponse? Config, string? Error)> UpdateSettingsAsync(
        UpdateBotSettingsRequest request, CancellationToken ct = default)
    {
        var settings = await EnsureSettingsAsync(ct);

        if (request.Symbols is not null)
        {
            var (ok, symbols, error) = NormalizeSymbols(request.Symbols);
            if (!ok) return (false, null, error);
            settings.SymbolsJson = JsonSerializer.Serialize(symbols, JsonOpts);
        }

        if (request.Level is not null)
        {
            var level = request.Level.Trim().ToLowerInvariant();
            if (!AllowedLevels.Contains(level))
                return (false, null, "Level must be safe, regular, or risky.");
            settings.Level = level;
        }

        if (request.DryRun is { } dryRun) settings.DryRun = dryRun;
        if (request.Paused is { } paused) settings.Paused = paused;
        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return (true, await GetConfigAsync(ct), null);
    }

    public async Task<IReadOnlyList<BotRunDto>> ListRunsAsync(
        string? symbol, string? status, int limit, CancellationToken ct = default)
    {
        var take = Math.Clamp(limit, 1, 500);
        var q = db.BotRuns.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(symbol))
        {
            var s = symbol.Trim().ToUpperInvariant();
            q = q.Where(r => r.Symbol == s);
        }
        if (!string.IsNullOrWhiteSpace(status))
        {
            var st = status.Trim().ToLowerInvariant();
            q = q.Where(r => r.Status == st);
        }
        var rows = await q.OrderByDescending(r => r.At).ThenByDescending(r => r.Id)
            .Take(take)
            .ToListAsync(ct);
        return rows.Select(ToRunDto).ToList();
    }

    public async Task<(bool Ok, BotRunDto? Run, string? Error)> AppendRunAsync(
        CreateBotRunRequest request, CancellationToken ct = default)
    {
        var (symOk, symbol, symErr) = NormalizeOneSymbol(request.Symbol);
        if (!symOk && request.Symbol.Trim() != "*")
            return (false, null, symErr);
        var storedSymbol = request.Symbol.Trim() == "*" ? "*" : symbol!;

        var status = request.Status.Trim().ToLowerInvariant();
        if (!AllowedStatuses.Contains(status))
            return (false, null, "Status must be skipped, dry_run, placed, filled, canceled, blocked, or error.");

        if (string.IsNullOrWhiteSpace(request.TargetFriday))
            return (false, null, "TargetFriday is required.");

        var row = new BotRun
        {
            At = request.At.UtcDateTime,
            Symbol = storedSymbol,
            TargetFriday = request.TargetFriday.Trim(),
            Side = (request.Side ?? "").Trim(),
            Qty = request.Qty,
            DryRun = request.DryRun,
            Status = status,
            Reason = Truncate(request.Reason, 500),
            ContractSymbol = Truncate(request.ContractSymbol, 64),
            Strike = request.Strike,
            SellLimit = request.SellLimit,
            OrderId = Truncate(request.OrderId, 128),
            ClientOrderId = Truncate(request.ClientOrderId, 128),
            BlockersJson = SerializeList(request.Blockers),
            WarningsJson = SerializeList(request.Warnings),
        };
        db.BotRuns.Add(row);
        await db.SaveChangesAsync(ct);
        return (true, ToRunDto(row), null);
    }

    public async Task<(bool Ok, BotLastCycleDto? Cycle, string? Error)> UpsertLastCycleAsync(
        UpsertBotLastCycleRequest request, CancellationToken ct = default)
    {
        var (ok, symbol, error) = NormalizeOneSymbol(request.Symbol);
        if (!ok) return (false, null, error);
        if (string.IsNullOrWhiteSpace(request.TargetFriday))
            return (false, null, "TargetFriday is required.");
        if (string.IsNullOrWhiteSpace(request.ClientOrderId))
            return (false, null, "ClientOrderId is required.");
        if (string.IsNullOrWhiteSpace(request.Status))
            return (false, null, "Status is required.");

        var row = await db.BotLastCycles.FirstOrDefaultAsync(c => c.Symbol == symbol, ct);
        if (row is null)
        {
            row = new BotLastCycle { Symbol = symbol! };
            db.BotLastCycles.Add(row);
        }
        row.TargetFriday = request.TargetFriday.Trim();
        row.ClientOrderId = Truncate(request.ClientOrderId, 128)!;
        row.At = request.At.UtcDateTime;
        row.Status = request.Status.Trim().ToLowerInvariant();
        row.RetryIndex = Math.Max(0, request.RetryIndex ?? 0);
        await db.SaveChangesAsync(ct);
        return (true, ToLastCycleDto(row), null);
    }

    public async Task<int> ClearLastCycleAsync(string? symbol, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(symbol))
        {
            var all = await db.BotLastCycles.ToListAsync(ct);
            db.BotLastCycles.RemoveRange(all);
            await db.SaveChangesAsync(ct);
            return all.Count;
        }

        var (ok, normalized, _) = NormalizeOneSymbol(symbol);
        if (!ok) return 0;
        var rows = await db.BotLastCycles.Where(c => c.Symbol == normalized).ToListAsync(ct);
        if (rows.Count == 0) return 0;
        db.BotLastCycles.RemoveRange(rows);
        await db.SaveChangesAsync(ct);
        return rows.Count;
    }

    private async Task<BotSettings> EnsureSettingsAsync(CancellationToken ct)
    {
        var settings = await db.BotSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (settings is not null) return settings;
        settings = new BotSettings
        {
            Id = 1,
            SymbolsJson = JsonSerializer.Serialize(DefaultSymbols, JsonOpts),
            Level = "regular",
            DryRun = true,
            Paused = false,
            UpdatedAt = DateTime.UtcNow,
        };
        db.BotSettings.Add(settings);
        await db.SaveChangesAsync(ct);
        return settings;
    }

    public static (bool Ok, IReadOnlyList<string>? Symbols, string? Error) NormalizeSymbols(
        IReadOnlyList<string> raw)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var list = new List<string>();
        foreach (var item in raw)
        {
            var (ok, symbol, error) = NormalizeOneSymbol(item);
            if (!ok) return (false, null, error);
            if (seen.Add(symbol!)) list.Add(symbol!);
        }
        if (list.Count == 0)
            return (false, null, "At least one symbol is required.");
        if (list.Count > MaxSymbols)
            return (false, null, $"At most {MaxSymbols} symbols are allowed.");
        return (true, list, null);
    }

    public static (bool Ok, string? Symbol, string? Error) NormalizeOneSymbol(string? raw)
    {
        var symbol = (raw ?? "").Trim().ToUpperInvariant();
        if (!SymbolRe.IsMatch(symbol))
            return (false, null, $"Invalid symbol '{raw}'. Use 1–10 characters: A–Z, digits, dot.");
        return (true, symbol, null);
    }

    private static BotSettingsDto ToSettingsDto(BotSettings settings)
    {
        IReadOnlyList<string> symbols;
        try
        {
            symbols = JsonSerializer.Deserialize<List<string>>(settings.SymbolsJson) ?? [.. DefaultSymbols];
        }
        catch (JsonException)
        {
            symbols = DefaultSymbols;
        }
        return new BotSettingsDto(
            symbols,
            settings.Level,
            settings.DryRun,
            settings.Paused,
            new DateTimeOffset(DateTime.SpecifyKind(settings.UpdatedAt, DateTimeKind.Utc)));
    }

    private static BotLastCycleDto ToLastCycleDto(BotLastCycle row) =>
        new(
            row.Symbol,
            row.TargetFriday,
            row.ClientOrderId,
            new DateTimeOffset(DateTime.SpecifyKind(row.At, DateTimeKind.Utc)),
            row.Status,
            row.RetryIndex);

    private static BotRunDto ToRunDto(BotRun row) =>
        new(
            new DateTimeOffset(DateTime.SpecifyKind(row.At, DateTimeKind.Utc)),
            row.Symbol,
            row.TargetFriday,
            row.Side,
            row.Qty,
            row.DryRun,
            row.Status,
            row.Reason,
            row.ContractSymbol,
            row.Strike,
            row.SellLimit,
            row.OrderId,
            row.ClientOrderId,
            DeserializeList(row.BlockersJson),
            DeserializeList(row.WarningsJson));

    private static string? SerializeList(IReadOnlyList<string>? items) =>
        items is { Count: > 0 } ? JsonSerializer.Serialize(items, JsonOpts) : null;

    private static IReadOnlyList<string>? DeserializeList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= max ? value : value[..max];
    }
}
