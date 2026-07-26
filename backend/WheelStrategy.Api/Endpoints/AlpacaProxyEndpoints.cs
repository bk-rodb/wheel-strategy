using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Options;

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
/// </summary>
public static class AlpacaProxyEndpoints
{
    public const string HttpClientName = "alpaca-proxy";

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
            // Surface this rather than degrade to empty data — a trading UI must not
            // render "no positions" when the truth is "not configured".
            return Results.Problem(
                title: "Alpaca credentials not configured",
                detail: "Set Alpaca:ApiKeyId and Alpaca:ApiSecretKey via user-secrets "
                    + "or environment variables on the backend.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var isOrderMutation = AlpacaProxyPolicy.IsOrderMutation(upstream, method, path);
        if (isOrderMutation && !proxy.AllowOrderPlacement)
        {
            return Results.Problem(
                title: "Order entry disabled",
                detail: "AlpacaProxy:AllowOrderPlacement is false on the backend.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        string? bodyJson = null;
        if (string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase))
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
                if (validationError is not null)
                {
                    logger.LogWarning("Alpaca proxy rejected an order body: {Reason}", validationError);
                    return Results.Problem(
                        title: "Order rejected by proxy policy",
                        detail: validationError,
                        statusCode: StatusCodes.Status400BadRequest);
                }
            }

            bodyJson = raw;
        }

        var baseUrl = upstream == AlpacaProxyPolicy.Upstream.Trading
            ? alpaca.TradingBaseUrl
            : alpaca.DataBaseUrl;

        // `path` is the routing-decoded path, and the allowlist has already limited it
        // to [A-Za-z0-9_.:/-] — every character legal unencoded in a URL path. So it is
        // forwarded as-is: re-encoding would turn Alpaca's literal ':' in
        // /v2/orders:by_client_order_id/{id} into %3A. The query string is passed
        // through still-encoded, exactly as the browser sent it.
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
                // Order mutations are the audit trail worth keeping; the body is not
                // logged because it identifies positions, and never the credentials.
                logger.LogInformation(
                    "Alpaca proxy {Method} {Path} → {Status}",
                    method, path, (int)upstreamResponse.StatusCode);
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
            // Caller navigated away or aborted; nothing to report.
            return Results.Empty;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Alpaca proxy timed out on {Method} {Path}", method, path);
            return Results.Problem(
                title: "Upstream Alpaca request timed out",
                detail: $"No response within {proxy.TimeoutSeconds}s.",
                statusCode: StatusCodes.Status504GatewayTimeout);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Alpaca proxy transport failure on {Method} {Path}", method, path);
            return Results.Problem(
                title: "Upstream Alpaca request failed",
                detail: ex.Message,
                statusCode: StatusCodes.Status502BadGateway);
        }
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
