using System.Text.Json;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Options;
using static WheelStrategy.Api.Alpaca.AlpacaProxyPolicy;

namespace WheelStrategy.Api.Tests;

/// <summary>
/// The proxy carries credentials that can place and cancel real orders, so these
/// tests pin down both halves of its contract: which routes reach Alpaca at all,
/// and which order bodies are allowed through.
/// </summary>
public class AlpacaProxyPolicyTests
{
    private static readonly AlpacaProxyOptions Opts = new();

    private static JsonElement Json(string raw) =>
        JsonDocument.Parse(raw).RootElement.Clone();

    private static string ValidOrder(
        string symbol = "NVDA250801P00150000",
        string qty = "1",
        string side = "sell",
        string type = "limit",
        string tif = "day",
        string? limitPrice = "2.50",
        string? positionIntent = null,
        string clientOrderId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301")
    {
        var fields = new List<string>
        {
            $"\"symbol\":\"{symbol}\"",
            $"\"qty\":\"{qty}\"",
            $"\"side\":\"{side}\"",
            $"\"type\":\"{type}\"",
            $"\"time_in_force\":\"{tif}\"",
            $"\"client_order_id\":\"{clientOrderId}\"",
        };
        if (limitPrice is not null) fields.Add($"\"limit_price\":\"{limitPrice}\"");
        if (positionIntent is not null) fields.Add($"\"position_intent\":\"{positionIntent}\"");
        return "{" + string.Join(",", fields) + "}";
    }

    // ─── Route allowlist ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("v2/account")]
    [InlineData("v2/account/activities")]
    [InlineData("v2/positions")]
    [InlineData("v2/assets")]
    [InlineData("v2/assets/NVDA")]
    [InlineData("v2/assets/BRK.B")]
    [InlineData("v2/options/contracts")]
    [InlineData("v2/orders")]
    [InlineData("v2/orders/3f2504e0-4f89-11d3-9a0c-0305e82c3301")]
    [InlineData("v2/orders:by_client_order_id/3f2504e0-4f89-11d3-9a0c-0305e82c3301")]
    public void Allows_the_trading_routes_the_desk_uses(string path)
    {
        Assert.True(IsAllowed(Upstream.Trading, "GET", path));
    }

    [Theory]
    [InlineData("v2/stocks/snapshots")]
    [InlineData("v2/stocks/bars")]
    [InlineData("v1beta1/options/snapshots")]
    [InlineData("v1beta1/news")]
    public void Allows_the_market_data_routes_the_desk_uses(string path)
    {
        Assert.True(IsAllowed(Upstream.MarketData, "GET", path));
    }

    [Fact]
    public void Allows_placing_and_canceling_orders()
    {
        Assert.True(IsAllowed(Upstream.Trading, "POST", "v2/orders"));
        Assert.True(IsAllowed(Upstream.Trading, "DELETE", "v2/orders/abc-123"));
    }

    [Theory]
    // Liquidation and account mutation are never proxied, whatever the method.
    [InlineData("DELETE", "v2/positions")]
    [InlineData("DELETE", "v2/positions/NVDA")]
    [InlineData("DELETE", "v2/orders")]
    [InlineData("PATCH", "v2/orders/abc")]
    [InlineData("POST", "v2/account/configurations")]
    [InlineData("GET", "v2/account/configurations")]
    [InlineData("POST", "v2/positions")]
    // Unlisted read surfaces stay closed too.
    [InlineData("GET", "v2/watchlists")]
    [InlineData("GET", "v2/account/portfolio/history")]
    public void Refuses_routes_outside_the_allowlist(string method, string path)
    {
        Assert.False(IsAllowed(Upstream.Trading, method, path));
    }

    [Fact]
    public void Refuses_market_data_routes_on_the_trading_host_and_vice_versa()
    {
        Assert.False(IsAllowed(Upstream.Trading, "GET", "v2/stocks/bars"));
        Assert.False(IsAllowed(Upstream.MarketData, "GET", "v2/positions"));
    }

    [Fact]
    public void Market_data_is_read_only()
    {
        Assert.False(IsAllowed(Upstream.MarketData, "POST", "v2/stocks/bars"));
        Assert.False(IsAllowed(Upstream.MarketData, "DELETE", "v2/stocks/bars"));
    }

    [Theory]
    [InlineData("../v2/account")]
    [InlineData("v2/assets/../../account")]
    [InlineData("/v2/positions")]
    [InlineData("v2//positions")]
    [InlineData("")]
    [InlineData("   ")]
    public void Refuses_traversal_and_malformed_paths(string path)
    {
        Assert.False(IsAllowed(Upstream.Trading, "GET", path));
        Assert.False(IsAllowed(Upstream.MarketData, "GET", path));
    }

    [Fact]
    public void Refuses_extra_path_segments_after_a_single_segment_route()
    {
        // A decoded %2F must not smuggle a second segment past the allowlist.
        Assert.False(IsAllowed(Upstream.Trading, "GET", "v2/orders/abc/extra"));
        Assert.False(IsAllowed(Upstream.Trading, "DELETE", "v2/orders/abc/extra"));
        Assert.False(IsAllowed(Upstream.Trading, "GET", "v2/assets/NVDA/options"));
    }

    [Fact]
    public void Refuses_ids_with_characters_that_would_need_encoding()
    {
        Assert.False(IsAllowed(Upstream.Trading, "GET", "v2/orders/abc def"));
        Assert.False(IsAllowed(Upstream.Trading, "GET", "v2/orders/abc?x=1"));
        Assert.False(IsAllowed(Upstream.Trading, "GET", "v2/assets/nvda@x"));
    }

    [Fact]
    public void Identifies_order_mutations_for_logging_and_the_kill_switch()
    {
        Assert.True(IsOrderMutation(Upstream.Trading, "POST", "v2/orders"));
        Assert.True(IsOrderMutation(Upstream.Trading, "DELETE", "v2/orders/abc"));
        Assert.False(IsOrderMutation(Upstream.Trading, "GET", "v2/orders"));
        Assert.False(IsOrderMutation(Upstream.MarketData, "GET", "v2/stocks/bars"));
    }

    // ─── Order body validation ───────────────────────────────────────────────

    [Fact]
    public void Accepts_a_well_formed_sell_to_open_limit_order()
    {
        Assert.Null(ValidateOrderRequest(Json(ValidOrder()), Opts));
    }

    [Fact]
    public void Accepts_a_market_order_without_a_limit_price()
    {
        var body = ValidOrder(type: "market", limitPrice: null);
        Assert.Null(ValidateOrderRequest(Json(body), Opts));
    }

    [Fact]
    public void Accepts_numeric_qty_and_limit_price()
    {
        var body = """
            {"symbol":"NVDA250801P00150000","qty":2,"side":"sell","type":"limit",
             "time_in_force":"day","client_order_id":"abc-123","limit_price":2.5}
            """;
        Assert.Null(ValidateOrderRequest(Json(body), Opts));
    }

    [Theory]
    [InlineData("buy_to_close")]
    [InlineData("sell_to_open")]
    public void Accepts_recognised_position_intents(string intent)
    {
        var body = ValidOrder(positionIntent: intent);
        Assert.Null(ValidateOrderRequest(Json(body), Opts));
    }

    [Fact]
    public void Rejects_an_unrecognised_position_intent()
    {
        var body = ValidOrder(positionIntent: "liquidate_everything");
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Fact]
    public void Rejects_unknown_fields_rather_than_stripping_them()
    {
        // Silently dropping a field would place an order the caller did not describe.
        var body = """
            {"symbol":"NVDA","qty":"1","side":"sell","type":"market",
             "time_in_force":"day","client_order_id":"abc","notional":"100000"}
            """;
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Theory]
    [InlineData("side", "hold")]
    [InlineData("type", "trailing_stop")]
    [InlineData("time_in_force", "opg")]
    public void Rejects_values_outside_the_supported_enums(string field, string value)
    {
        var body = field switch
        {
            "side" => ValidOrder(side: value),
            "type" => ValidOrder(type: value),
            _ => ValidOrder(tif: value),
        };
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Fact]
    public void Requires_a_client_order_id_so_retries_reconcile()
    {
        var body = """
            {"symbol":"NVDA","qty":"1","side":"sell","type":"market","time_in_force":"day"}
            """;
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("1.5")]
    [InlineData("abc")]
    public void Rejects_non_positive_or_fractional_quantities(string qty)
    {
        Assert.NotNull(ValidateOrderRequest(Json(ValidOrder(qty: qty)), Opts));
    }

    [Fact]
    public void Rejects_a_quantity_over_the_configured_cap()
    {
        var body = ValidOrder(qty: (Opts.MaxOrderQty + 1).ToString());
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Fact]
    public void Rejects_a_limit_order_with_no_limit_price()
    {
        var body = ValidOrder(type: "limit", limitPrice: null);
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Fact]
    public void Rejects_a_market_order_carrying_a_limit_price()
    {
        var body = ValidOrder(type: "market", limitPrice: "2.50");
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-2.50")]
    public void Rejects_a_non_positive_limit_price(string limit)
    {
        Assert.NotNull(ValidateOrderRequest(Json(ValidOrder(limitPrice: limit)), Opts));
    }

    [Fact]
    public void Rejects_a_limit_price_over_the_fat_finger_cap()
    {
        var body = ValidOrder(limitPrice: (Opts.MaxLimitPrice + 1).ToString());
        Assert.NotNull(ValidateOrderRequest(Json(body), Opts));
    }

    [Fact]
    public void Rejects_an_order_whose_notional_exceeds_the_cap()
    {
        // Each side is individually legal; only qty * limit * 100 breaches the cap.
        var opts = new AlpacaProxyOptions { MaxOrderNotional = 10_000m };
        var body = ValidOrder(qty: "10", limitPrice: "50.00");
        Assert.NotNull(ValidateOrderRequest(Json(body), opts));
    }

    [Fact]
    public void Counts_notional_on_the_hundred_share_contract_multiplier()
    {
        var opts = new AlpacaProxyOptions { MaxOrderNotional = 1_000m };
        // 2 * 4.00 * 100 = 800, inside the cap.
        Assert.Null(ValidateOrderRequest(Json(ValidOrder(qty: "2", limitPrice: "4.00")), opts));
        // 3 * 4.00 * 100 = 1200, outside it.
        Assert.NotNull(ValidateOrderRequest(Json(ValidOrder(qty: "3", limitPrice: "4.00")), opts));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("nvda; DROP")]
    [InlineData("../../etc")]
    public void Rejects_malformed_symbols(string symbol)
    {
        Assert.NotNull(ValidateOrderRequest(Json(ValidOrder(symbol: symbol)), Opts));
    }

    [Fact]
    public void Rejects_a_body_that_is_not_an_object()
    {
        Assert.NotNull(ValidateOrderRequest(Json("[]"), Opts));
        Assert.NotNull(ValidateOrderRequest(Json("\"sell everything\""), Opts));
    }
}
