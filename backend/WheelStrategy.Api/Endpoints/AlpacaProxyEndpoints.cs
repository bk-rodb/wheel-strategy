using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Orders;

namespace WheelStrategy.Api.Endpoints;

/// <summary>
/// Browser-facing passthrough to Alpaca, so the SPA needs no credentials.
///
/// Vite inlines every VITE_-prefixed variable into the production bundle as a
/// literal string, which put a key that authorizes POST /v2/orders into every
/// dist/ build. The browser now calls these routes instead and the APCA-* headers
/// are attached here, from user-secrets.
///
/// Requests are allowlisted by <see cref="AlpacaProxyPolicy"/> and order bodies
/// are validated against <see cref="AlpacaProxyOptions"/> — this endpoint holds
/// order-entry credentials, so it must not be a general-purpose forwarder.
///
/// Order mutations also update the durable <see cref="IOrderJournalService"/>.
/// </summary>
public static class AlpacaProxyEndpoints
{
    public const string HttpClientName = "alpaca-proxy";

    public const string OrderSourceHeader = "X-Wheel-Order-Source";

    private const string TradingPrefix = "/api/alpaca/trading/";
    private const string DataPrefix = "/api/alpaca/data/";

    /// <summary>Cap on a proxied order body; the real ones are a few hundred bytes.</summary>
    private const int MaxBodyBytes = 16 * 1024;

    public static IEndpointRouteBuilder MapAlpacaProxyEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapMethods(
                $"{TradingPrefix}{{**path}}",
                ["GET", "POST", "DELETE"],
                (HttpContext ctx, string path) => Forward(ctx, AlpacaProxyPolicy.Upstream.Trading, path))
            .WithName("AlpacaTradingProxy")
            .ExcludeFromDescription();

        app.MapMethods(
                $"{DataPrefix}{{**path}}",
                ["GET"],
                (HttpContext ctx, string path) => Forward(ctx, AlpacaProxyPolicy.Upstream.MarketData, path))
            .WithName("AlpacaMarketDataProxy")
            .ExcludeFromDescription();

        return app;
    }

    private static async Task<IResult> Forward(
        HttpContext ctx,
        AlpacaProxyPolicy.Upstream upstream,
        string path)
    {
        var alpaca = ctx.RequestServices.GetRequiredService<IOptions<AlpacaOptions>>().Value;
        var proxy = ctx.RequestServices.GetRequiredService<IOptions<AlpacaProxyOptions>>().Value;
        var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(AlpacaProxyEndpoints));
        var journal = ctx.RequestServices.GetRequiredService<IOrderJournalService>();

        var method = ctx.Request.Method;
        var ct = ctx.RequestAborted;

        if (!AlpacaProxyPolicy.IsAllowed(upstream, method, path))
        {
            logger.LogWarning("Alpaca proxy refused {Method} {Upstream}/{Path}", method, upstream, path);
            return Results.Problem(
                title: "Route not proxied",
                detail: $"{method} {path} is not an allowed Alpaca route.",
                statusCode: StatusCodes.Status404NotFound);
        }

        if (!alpaca.HasCredentials)
        {
            return Results.Problem(
                title: "Alpaca credentials not configured",
                detail: "Set Alpaca:ApiKeyId and Alpaca:ApiSecretKey via user-secrets "
                    + "or environment variables on the backend.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var isOrderMutation = AlpacaProxyPolicy.IsOrderMutation(upstream, method, path);
        var isPlace = isOrderMutation
            && string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase);
        var isCancel = isOrderMutation
            && string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase);

        string? bodyJson = null;
        PlaceIntent? placeIntent = null;

        if (string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase)
            && upstream == AlpacaProxyPolicy.Upstream.Trading
            && path == "v2/orders")
        {
            var (ok, raw, error) = await ReadBodyAsync(ctx.Request, ct);
            if (!ok)
            {
                return Results.Problem(
                    title: "Invalid order body",
                    detail: error,
                    statusCode: StatusCodes.Status400BadRequest);
            }

            JsonDocument doc;
            try
            {
                doc = JsonDocument.Parse(raw);
            }
            catch (JsonException ex)
            {
                return Results.Problem(
                    title: "Invalid order body",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status400BadRequest);
            }

            using (doc)
            {
                var validationError = AlpacaProxyPolicy.ValidateOrderRequest(doc.RootElement, proxy);
                placeIntent = TryParsePlaceIntent(doc.RootElement, ResolveSource(ctx));

                if (validationError is not null)
                {
                    logger.LogWarning("Alpaca proxy rejected an order body: {Reason}", validationError);
                    if (placeIntent is not null)
                        await journal.MarkRejectedLocalAsync(placeIntent, validationError, ct);
                    return Results.Problem(
                        title: "Order rejected by proxy policy",
                        detail: validationError,
                        statusCode: StatusCodes.Status400BadRequest);
                }
            }

            bodyJson = raw;

            if (!proxy.AllowOrderPlacement)
            {
                if (placeIntent is not null)
                {
                    await journal.MarkBlockedAsync(
                        placeIntent, "AlpacaProxy:AllowOrderPlacement is false on the backend.", ct);
                }
                return Results.Problem(
                    title: "Order entry disabled",
                    detail: "AlpacaProxy:AllowOrderPlacement is false on the backend.",
                    statusCode: StatusCodes.Status403Forbidden);
            }

            var (began, conflict, beginError) = await journal.TryBeginPlaceAsync(placeIntent!, ct);
            if (!began)
            {
                return Results.Problem(
                    title: "Order already open for underlying",
                    detail: beginError ?? "Conflicting open intent.",
                    statusCode: StatusCodes.Status409Conflict,
                    extensions: conflict is null
                        ? null
                        : new Dictionary<string, object?>
                        {
                            ["clientOrderId"] = conflict.ClientOrderId,
                            ["alpacaOrderId"] = conflict.AlpacaOrderId,
                            ["deskState"] = conflict.DeskState,
                        });
            }
        }
        else if (isOrderMutation && !proxy.AllowOrderPlacement)
        {
            return Results.Problem(
                title: "Order entry disabled",
                detail: "AlpacaProxy:AllowOrderPlacement is false on the backend.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        if (isCancel && path.StartsWith("v2/orders/", StringComparison.Ordinal))
        {
            var orderId = path["v2/orders/".Length..];
            await journal.MarkCancelRequestedAsync(orderId, ct);
        }

        var baseUrl = upstream == AlpacaProxyPolicy.Upstream.Trading
            ? alpaca.TradingBaseUrl
            : alpaca.DataBaseUrl;

        var query = ctx.Request.QueryString.Value ?? string.Empty;
        var targetUrl = $"{baseUrl.TrimEnd('/')}/{path}{query}";

        using var request = new HttpRequestMessage(new HttpMethod(method), targetUrl);
        request.Headers.Add("APCA-API-KEY-ID", alpaca.ApiKeyId);
        request.Headers.Add("APCA-API-SECRET-KEY", alpaca.ApiSecretKey);

        if (bodyJson is not null)
        {
            request.Content = new StringContent(bodyJson, Encoding.UTF8);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        }

        var factory = ctx.RequestServices.GetRequiredService<IHttpClientFactory>();
        var http = factory.CreateClient(HttpClientName);

        try
        {
            using var upstreamResponse = await http.SendAsync(
                request, HttpCompletionOption.ResponseHeadersRead, ct);

            var payload = await upstreamResponse.Content.ReadAsByteArrayAsync(ct);

            if (isOrderMutation)
            {
                logger.LogInformation(
                    "Alpaca proxy {Method} {Path} → {Status}",
                    method, path, (int)upstreamResponse.StatusCode);
            }

            if (isPlace && placeIntent is not null && upstreamResponse.IsSuccessStatusCode && payload.Length > 0)
            {
                try
                {
                    using var orderDoc = JsonDocument.Parse(payload);
                    await journal.ApplyBrokerOrderJsonAsync(
                        placeIntent.ClientOrderId, orderDoc.RootElement, ct: ct);
                }
                catch (JsonException ex)
                {
                    logger.LogWarning(ex, "Could not parse place response for journal");
                }
            }

            if (isCancel && upstreamResponse.IsSuccessStatusCode)
            {
                var orderId = path["v2/orders/".Length..];
                await journal.MarkCancelPendingAsync(orderId, ct);
            }

            // Sync journal when the desk polls a single order.
            if (upstream == AlpacaProxyPolicy.Upstream.Trading
                && string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase)
                && path.StartsWith("v2/orders/", StringComparison.Ordinal)
                && !path.Contains(":by_client_order_id", StringComparison.Ordinal)
                && upstreamResponse.IsSuccessStatusCode
                && payload.Length > 0)
            {
                try
                {
                    using var orderDoc = JsonDocument.Parse(payload);
                    if (orderDoc.RootElement.TryGetProperty("client_order_id", out var cidEl)
                        && cidEl.ValueKind == JsonValueKind.String
                        && cidEl.GetString() is { Length: > 0 } cid)
                    {
                        await journal.ApplyBrokerOrderJsonAsync(cid, orderDoc.RootElement, ct: ct);
                    }
                }
                catch (JsonException)
                {
                    // advisory only
                }
            }

            ctx.Response.StatusCode = (int)upstreamResponse.StatusCode;

            if (upstreamResponse.Headers.TryGetValues("Retry-After", out var retryAfter))
                ctx.Response.Headers["Retry-After"] = retryAfter.ToArray();

            if (payload.Length == 0) return Results.Empty;

            var contentType = upstreamResponse.Content.Headers.ContentType?.ToString()
                ?? "application/json";
            return Results.Bytes(payload, contentType);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            return Results.Empty;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Alpaca proxy timed out on {Method} {Path}", method, path);
            if (isPlace && placeIntent is not null)
            {
                var recovered = await TryRecoverPlaceAsync(
                    journal, http, alpaca, placeIntent, logger, ct);
                if (recovered is not null) return recovered;
            }
            return Results.Problem(
                title: "Upstream Alpaca request timed out",
                detail: $"No response within {proxy.TimeoutSeconds}s.",
                statusCode: StatusCodes.Status504GatewayTimeout);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Alpaca proxy transport failure on {Method} {Path}", method, path);
            if (isPlace && placeIntent is not null)
            {
                var recovered = await TryRecoverPlaceAsync(
                    journal, http, alpaca, placeIntent, logger, ct);
                if (recovered is not null) return recovered;
            }
            return Results.Problem(
                title: "Upstream Alpaca request failed",
                detail: ex.Message,
                statusCode: StatusCodes.Status502BadGateway);
        }
    }

    /// <summary>
    /// After a lost POST response, look up by client_order_id. If the order landed,
    /// return it as 200 so the desk never double-places.
    /// </summary>
    private static async Task<IResult?> TryRecoverPlaceAsync(
        IOrderJournalService journal,
        HttpClient http,
        AlpacaOptions alpaca,
        PlaceIntent intent,
        ILogger logger,
        CancellationToken ct)
    {
        await journal.MarkOrphanCheckAsync(intent.ClientOrderId, "POST transport failure — reconciling", ct);

        var url =
            $"{alpaca.TradingBaseUrl.TrimEnd('/')}/v2/orders:by_client_order_id/{Uri.EscapeDataString(intent.ClientOrderId)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("APCA-API-KEY-ID", alpaca.ApiKeyId);
        req.Headers.Add("APCA-API-SECRET-KEY", alpaca.ApiSecretKey);

        try
        {
            using var res = await http.SendAsync(req, ct);
            var bytes = await res.Content.ReadAsByteArrayAsync(ct);
            if (res.IsSuccessStatusCode && bytes.Length > 0)
            {
                using var doc = JsonDocument.Parse(bytes);
                await journal.ApplyBrokerOrderJsonAsync(intent.ClientOrderId, doc.RootElement, ct: ct);
                logger.LogInformation(
                    "Recovered place via client_order_id {ClientOrderId}", intent.ClientOrderId);
                return Results.Bytes(bytes, "application/json");
            }

            await journal.MarkSubmitFailedAsync(
                intent.ClientOrderId,
                $"POST failed and reconcile found no order (status={(int)res.StatusCode})",
                ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException)
        {
            logger.LogWarning(ex, "Orphan reconcile failed for {ClientOrderId}", intent.ClientOrderId);
            await journal.MarkSubmitFailedAsync(
                intent.ClientOrderId, $"POST failed; reconcile error: {ex.Message}", ct);
        }

        return null;
    }

    private static string ResolveSource(HttpContext ctx)
    {
        if (ctx.Request.Headers.TryGetValue(OrderSourceHeader, out var values))
        {
            var v = values.FirstOrDefault();
            if (string.Equals(v, "bot", StringComparison.OrdinalIgnoreCase)) return "bot";
        }
        return "desk";
    }

    private static PlaceIntent? TryParsePlaceIntent(JsonElement body, string source)
    {
        if (!body.TryGetProperty("client_order_id", out var cidEl)
            || cidEl.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(cidEl.GetString()))
            return null;
        if (!body.TryGetProperty("symbol", out var symEl)
            || symEl.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(symEl.GetString()))
            return null;

        var qty = body.TryGetProperty("qty", out var qtyEl)
            ? qtyEl.ValueKind == JsonValueKind.String ? qtyEl.GetString() ?? "0" : qtyEl.ToString()
            : "0";
        var side = body.TryGetProperty("side", out var sideEl) && sideEl.ValueKind == JsonValueKind.String
            ? sideEl.GetString() ?? "sell"
            : "sell";
        string? limit = null;
        if (body.TryGetProperty("limit_price", out var lp)
            && lp.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
        {
            limit = lp.ValueKind == JsonValueKind.String ? lp.GetString() : lp.ToString();
        }

        return new PlaceIntent(cidEl.GetString()!, symEl.GetString()!, side, qty, limit, source);
    }

    private static async Task<(bool ok, string body, string? error)> ReadBodyAsync(
        HttpRequest request, CancellationToken ct)
    {
        if (request.ContentLength > MaxBodyBytes)
            return (false, string.Empty, $"Body exceeds {MaxBodyBytes} bytes.");

        using var reader = new StreamReader(request.Body, Encoding.UTF8);
        var buffer = new char[MaxBodyBytes + 1];
        var read = await reader.ReadBlockAsync(buffer, ct);

        if (read > MaxBodyBytes)
            return (false, string.Empty, $"Body exceeds {MaxBodyBytes} bytes.");
        if (read == 0)
            return (false, string.Empty, "Body is empty.");

        return (true, new string(buffer, 0, read), null);
    }
}
