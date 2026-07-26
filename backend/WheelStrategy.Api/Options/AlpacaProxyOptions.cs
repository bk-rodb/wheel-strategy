namespace WheelStrategy.Api.Options;

/// <summary>
/// Guardrails for the browser-facing Alpaca proxy. The proxy holds credentials
/// that authorize real orders, so an order body is validated against these caps
/// rather than forwarded blind. Non-secret — lives in appsettings.
/// </summary>
public class AlpacaProxyOptions
{
    public const string SectionName = "AlpacaProxy";

    /// <summary>Upstream request timeout, seconds.</summary>
    public int TimeoutSeconds { get; set; } = 15;

    /// <summary>Largest contract quantity a single order may request.</summary>
    public int MaxOrderQty { get; set; } = 50;

    /// <summary>Largest per-contract limit price accepted (fat-finger guard).</summary>
    public decimal MaxLimitPrice { get; set; } = 1000m;

    /// <summary>
    /// Largest notional a limit order may represent (qty * limit * 100).
    /// Market orders are unpriced and skip this check.
    /// </summary>
    public decimal MaxOrderNotional { get; set; } = 250_000m;

    /// <summary>
    /// When false the proxy rejects POST/DELETE on /v2/orders, leaving the desk
    /// read-only. Lets you run live market data without exposing order entry.
    /// </summary>
    public bool AllowOrderPlacement { get; set; } = true;
}
