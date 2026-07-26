using System.Text.Json;
using System.Text.RegularExpressions;
using WheelStrategy.Api.Options;

namespace WheelStrategy.Api.Alpaca;

/// <summary>
/// What the browser is allowed to ask the Alpaca proxy for.
///
/// The proxy carries credentials that can place and cancel real orders, so this
/// is an allowlist, not a filter: an unlisted path is refused rather than passed
/// upstream. Pure functions, no I/O — see WheelStrategy.Api.Tests.
/// </summary>
public static partial class AlpacaProxyPolicy
{
    /// <summary>Which Alpaca host a request is bound for.</summary>
    public enum Upstream
    {
        Trading,
        MarketData,
    }

    // Alpaca symbols: equities (NVDA, BRK.B) and OSI option symbols
    // (NVDA250801P00150000). Uppercase alphanumerics plus . / -.
    [GeneratedRegex(@"^[A-Z0-9][A-Z0-9.\/-]{0,31}$", RegexOptions.CultureInvariant)]
    private static partial Regex SymbolRegex { get; }

    // Order ids are UUIDs; client order ids are UUIDs or wheel-<ts>-<rand>.
    [GeneratedRegex(@"^[A-Za-z0-9_.:-]{1,128}$", RegexOptions.CultureInvariant)]
    private static partial Regex IdRegex { get; }

    private static readonly string[] MarketDataPaths =
    [
        "v2/stocks/snapshots",
        "v2/stocks/bars",
        "v1beta1/options/snapshots",
        "v1beta1/news",
    ];

    private static readonly string[] TradingCollectionPaths =
    [
        "v2/account",
        "v2/account/activities",
        "v2/positions",
        "v2/assets",
        "v2/options/contracts",
        "v2/orders",
    ];

    private static readonly HashSet<string> AllowedOrderFields =
    [
        "symbol",
        "qty",
        "side",
        "type",
        "time_in_force",
        "client_order_id",
        "limit_price",
        "position_intent",
    ];

    private static readonly HashSet<string> AllowedSides = ["buy", "sell"];
    private static readonly HashSet<string> AllowedTypes = ["limit", "market"];
    private static readonly HashSet<string> AllowedTif = ["day", "gtc"];

    private static readonly HashSet<string> AllowedPositionIntents =
    [
        "buy_to_open",
        "buy_to_close",
        "sell_to_open",
        "sell_to_close",
    ];

    /// <summary>
    /// Is <paramref name="path"/> (decoded, no leading slash, no query) reachable
    /// on <paramref name="upstream"/> with <paramref name="method"/>?
    /// </summary>
    public static bool IsAllowed(Upstream upstream, string method, string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;

        // Defence in depth: the allowlist below would reject traversal anyway, but
        // refuse it outright so a future pattern can't be tricked into escaping.
        if (path.Contains("..", StringComparison.Ordinal)) return false;
        if (path.StartsWith('/') || path.Contains("//", StringComparison.Ordinal)) return false;

        return upstream switch
        {
            Upstream.MarketData => IsGet(method) && MarketDataPaths.Contains(path),
            Upstream.Trading => IsAllowedTradingPath(method, path),
            _ => false,
        };
    }

    private static bool IsGet(string method) =>
        string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase);

    private static bool IsAllowedTradingPath(string method, string path)
    {
        if (IsGet(method))
        {
            if (TradingCollectionPaths.Contains(path)) return true;

            // GET /v2/assets/{symbol}
            if (TrySingleSegmentSuffix(path, "v2/assets/", out var symbol))
                return SymbolRegex.IsMatch(symbol);

            // GET /v2/orders/{order_id}
            if (TrySingleSegmentSuffix(path, "v2/orders/", out var orderId))
                return IdRegex.IsMatch(orderId);

            // GET /v2/orders:by_client_order_id/{client_order_id}
            if (TrySingleSegmentSuffix(path, "v2/orders:by_client_order_id/", out var clientId))
                return IdRegex.IsMatch(clientId);

            return false;
        }

        if (string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase))
            return path == "v2/orders";

        if (string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase))
            return TrySingleSegmentSuffix(path, "v2/orders/", out var cancelId)
                && IdRegex.IsMatch(cancelId);

        return false;
    }

    /// <summary>
    /// True when <paramref name="path"/> is <paramref name="prefix"/> followed by
    /// exactly one more segment, which is returned in <paramref name="segment"/>.
    /// </summary>
    private static bool TrySingleSegmentSuffix(string path, string prefix, out string segment)
    {
        segment = string.Empty;
        if (!path.StartsWith(prefix, StringComparison.Ordinal)) return false;

        var rest = path[prefix.Length..];
        if (rest.Length == 0 || rest.Contains('/')) return false;

        segment = rest;
        return true;
    }

    /// <summary>Does this route place or cancel an order?</summary>
    public static bool IsOrderMutation(Upstream upstream, string method, string path)
    {
        if (upstream != Upstream.Trading) return false;
        if (string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase))
            return path == "v2/orders";
        if (string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase))
            return path.StartsWith("v2/orders/", StringComparison.Ordinal);
        return false;
    }

    /// <summary>
    /// Validate a POST /v2/orders body. Returns null when acceptable, otherwise a
    /// message safe to return to the browser.
    ///
    /// Unknown fields are rejected rather than stripped: the browser and this
    /// policy must agree on what an order can contain, and silently dropping a
    /// field would place an order the caller did not describe.
    /// </summary>
    public static string? ValidateOrderRequest(JsonElement body, AlpacaProxyOptions opts)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return "Order body must be a JSON object.";

        foreach (var prop in body.EnumerateObject())
        {
            if (!AllowedOrderFields.Contains(prop.Name))
                return $"Unsupported order field '{prop.Name}'.";
        }

        if (!TryGetNonEmptyString(body, "symbol", out var symbol))
            return "Order 'symbol' is required.";
        if (!SymbolRegex.IsMatch(symbol))
            return "Order 'symbol' is not a valid Alpaca symbol.";

        if (!TryGetNonEmptyString(body, "side", out var side) || !AllowedSides.Contains(side))
            return "Order 'side' must be 'buy' or 'sell'.";

        if (!TryGetNonEmptyString(body, "type", out var type) || !AllowedTypes.Contains(type))
            return "Order 'type' must be 'limit' or 'market'.";

        if (!TryGetNonEmptyString(body, "time_in_force", out var tif) || !AllowedTif.Contains(tif))
            return "Order 'time_in_force' must be 'day' or 'gtc'.";

        // Required so a retried or resumed place() reconciles to one venue order
        // instead of duplicating it.
        if (!TryGetNonEmptyString(body, "client_order_id", out var clientOrderId))
            return "Order 'client_order_id' is required for idempotency.";
        if (!IdRegex.IsMatch(clientOrderId))
            return "Order 'client_order_id' contains unsupported characters.";

        if (!TryGetPositiveInt(body, "qty", out var qty))
            return "Order 'qty' must be a positive whole number of contracts.";
        if (qty > opts.MaxOrderQty)
            return $"Order 'qty' {qty} exceeds the configured maximum of {opts.MaxOrderQty}.";

        var hasLimit = body.TryGetProperty("limit_price", out var limitProp)
            && limitProp.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined);

        if (type == "limit")
        {
            if (!hasLimit) return "A limit order requires 'limit_price'.";
            if (!TryReadDecimal(limitProp, out var limit) || limit <= 0)
                return "Order 'limit_price' must be a positive number.";
            if (limit > opts.MaxLimitPrice)
                return $"Order 'limit_price' {limit} exceeds the configured maximum of {opts.MaxLimitPrice}.";

            // Options are quoted per share on a 100-share contract.
            var notional = limit * qty * 100m;
            if (notional > opts.MaxOrderNotional)
                return $"Order notional {notional} exceeds the configured maximum of {opts.MaxOrderNotional}.";
        }
        else if (hasLimit)
        {
            return "A market order must not carry 'limit_price'.";
        }

        if (body.TryGetProperty("position_intent", out var intentProp)
            && intentProp.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
        {
            var intent = intentProp.ValueKind == JsonValueKind.String ? intentProp.GetString() : null;
            if (intent is null || !AllowedPositionIntents.Contains(intent))
                return "Order 'position_intent' is not a recognised value.";
        }

        return null;
    }

    private static bool TryGetNonEmptyString(JsonElement body, string name, out string value)
    {
        value = string.Empty;
        if (!body.TryGetProperty(name, out var prop)) return false;
        if (prop.ValueKind != JsonValueKind.String) return false;
        var raw = prop.GetString();
        if (string.IsNullOrWhiteSpace(raw)) return false;
        value = raw;
        return true;
    }

    /// <summary>Alpaca accepts quantities as numbers or strings; both are honoured.</summary>
    private static bool TryGetPositiveInt(JsonElement body, string name, out int value)
    {
        value = 0;
        if (!body.TryGetProperty(name, out var prop)) return false;

        switch (prop.ValueKind)
        {
            case JsonValueKind.Number:
                if (!prop.TryGetDecimal(out var num)) return false;
                if (num != decimal.Truncate(num) || num <= 0 || num > int.MaxValue) return false;
                value = (int)num;
                return true;
            case JsonValueKind.String:
                var raw = prop.GetString();
                if (!int.TryParse(raw, out var parsed) || parsed <= 0) return false;
                value = parsed;
                return true;
            default:
                return false;
        }
    }

    private static bool TryReadDecimal(JsonElement prop, out decimal value)
    {
        value = 0m;
        return prop.ValueKind switch
        {
            JsonValueKind.Number => prop.TryGetDecimal(out value),
            JsonValueKind.String => decimal.TryParse(
                prop.GetString(),
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out value),
            _ => false,
        };
    }
}
