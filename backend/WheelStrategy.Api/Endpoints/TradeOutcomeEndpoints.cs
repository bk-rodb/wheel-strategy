using System.Text.Json;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Orders;
using WheelStrategy.Api.Services;

namespace WheelStrategy.Api.Endpoints;

public static class TradeOutcomeEndpoints
{
    public static IEndpointRouteBuilder MapTradeOutcomeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/trades/outcomes", async (
            ITradeOutcomeService outcomes,
            string? underlying,
            string? outcomeLabel,
            bool? resolvedOnly,
            int? limit,
            CancellationToken ct) =>
        {
            var rows = await outcomes.ListAsync(
                underlying, outcomeLabel, resolvedOnly, limit ?? 100, ct);
            return Results.Ok(new TradeOutcomeListResponse(rows.Select(outcomes.ToDto).ToList()));
        })
        .WithName("ListTradeOutcomes")
        .WithTags("Trades")
        .Produces<TradeOutcomeListResponse>();

        app.MapGet("/api/trades/outcomes/{clientOrderId}", async (
            string clientOrderId,
            ITradeOutcomeService outcomes,
            CancellationToken ct) =>
        {
            var row = await outcomes.GetByClientOrderIdAsync(clientOrderId, ct);
            return row is null
                ? Results.Problem(
                    title: "Outcome not found",
                    detail: $"No outcome for client_order_id={clientOrderId}.",
                    statusCode: StatusCodes.Status404NotFound)
                : Results.Ok(outcomes.ToDto(row));
        })
        .WithName("GetTradeOutcome")
        .WithTags("Trades")
        .Produces<TradeOutcomeDto>()
        .ProducesProblem(404);

        app.MapPut("/api/trades/outcomes/{clientOrderId}/snapshot", async (
            string clientOrderId,
            AttachSnapshotRequest body,
            ITradeOutcomeService outcomes,
            CancellationToken ct) =>
        {
            if (body.Snapshot is null)
            {
                return Results.Problem(
                    title: "Snapshot required",
                    detail: "Request body must include snapshot.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var source = body.Source ?? "desk";
            var (ok, row, error) = await outcomes.AttachSnapshotAsync(
                clientOrderId, body.Snapshot, source, ct);
            if (!ok)
            {
                return Results.Problem(
                    title: "Snapshot rejected",
                    detail: error ?? "Unable to attach snapshot.",
                    statusCode: StatusCodes.Status409Conflict);
            }

            return Results.Ok(outcomes.ToDto(row!));
        })
        .WithName("AttachTradeOutcomeSnapshot")
        .WithTags("Trades")
        .Produces<TradeOutcomeDto>()
        .ProducesProblem(400)
        .ProducesProblem(409);

        app.MapPost("/api/trades/outcomes/{clientOrderId}/reconcile", async (
            string clientOrderId,
            ITradeOutcomeService outcomes,
            IHttpClientFactory httpFactory,
            IOptions<AlpacaOptions> alpacaOpts,
            IOptions<AlpacaProxyOptions> proxyOpts,
            IOrderJournalService journal,
            ILoggerFactory logFactory,
            CancellationToken ct) =>
        {
            var log = logFactory.CreateLogger("WheelStrategy.Api.Endpoints.TradeOutcomes");
            var alpaca = alpacaOpts.Value;
            if (!alpaca.HasCredentials)
            {
                return Results.Problem(
                    title: "Alpaca credentials not configured",
                    detail: "Cannot reconcile without Alpaca credentials.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var journalRow = await journal.GetByClientOrderIdAsync(clientOrderId, ct);
            var outcome = await outcomes.GetByClientOrderIdAsync(clientOrderId, ct);
            if (journalRow is null && outcome is null)
            {
                return Results.Problem(
                    title: "Outcome not found",
                    detail: $"No journal/outcome for client_order_id={clientOrderId}.",
                    statusCode: StatusCodes.Status404NotFound);
            }

            var http = httpFactory.CreateClient(AlpacaProxyEndpoints.HttpClientName);
            var baseUrl = alpaca.TradingBaseUrl.TrimEnd('/');
            string path;
            var alpacaOrderId = journalRow?.AlpacaOrderId ?? outcome?.AlpacaOrderId;
            if (!string.IsNullOrEmpty(alpacaOrderId))
                path = $"v2/orders/{alpacaOrderId}";
            else
                path = $"v2/orders:by_client_order_id/{Uri.EscapeDataString(clientOrderId)}";

            using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/{path}");
            req.Headers.Add("APCA-API-KEY-ID", alpaca.ApiKeyId);
            req.Headers.Add("APCA-API-SECRET-KEY", alpaca.ApiSecretKey);

            try
            {
                using var res = await http.SendAsync(req, ct);
                var bytes = await res.Content.ReadAsByteArrayAsync(ct);
                if (res.StatusCode == System.Net.HttpStatusCode.NotFound
                    || (int)res.StatusCode == 422)
                {
                    outcome = await outcomes.GetByClientOrderIdAsync(clientOrderId, ct);
                    return outcome is null
                        ? Results.Problem(
                            title: "Outcome not found",
                            detail: "Order missing at broker and no local outcome.",
                            statusCode: StatusCodes.Status404NotFound)
                        : Results.Ok(outcomes.ToDto(outcome));
                }

                if (!res.IsSuccessStatusCode)
                {
                    log.LogWarning(
                        "Outcome reconcile upstream {Status} for {ClientOrderId}",
                        (int)res.StatusCode, clientOrderId);
                    return Results.Problem(
                        title: "Upstream Alpaca reconcile failed",
                        detail: $"Alpaca returned {(int)res.StatusCode}.",
                        statusCode: StatusCodes.Status502BadGateway);
                }

                using var doc = JsonDocument.Parse(bytes);
                await journal.ApplyBrokerOrderJsonAsync(clientOrderId, doc.RootElement, ct: ct);
                await outcomes.SyncFromBrokerOrderAsync(clientOrderId, doc.RootElement, ct);
                outcome = await outcomes.GetByClientOrderIdAsync(clientOrderId, ct);
                return Results.Ok(outcomes.ToDto(outcome!));
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (OperationCanceledException)
            {
                return Results.Problem(
                    title: "Upstream Alpaca request timed out",
                    detail: $"No response within {proxyOpts.Value.TimeoutSeconds}s.",
                    statusCode: StatusCodes.Status504GatewayTimeout);
            }
            catch (HttpRequestException ex)
            {
                return Results.Problem(
                    title: "Upstream Alpaca request failed",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status502BadGateway);
            }
        })
        .WithName("ReconcileTradeOutcome")
        .WithTags("Trades")
        .Produces<TradeOutcomeDto>()
        .ProducesProblem(404)
        .ProducesProblem(502)
        .ProducesProblem(503)
        .ProducesProblem(504);

        app.MapPost("/api/trades/outcomes/{clientOrderId}/resolve", async (
            string clientOrderId,
            ResolveOutcomeRequest body,
            ITradeOutcomeService outcomes,
            IHttpClientFactory httpFactory,
            IOptions<AlpacaOptions> alpacaOpts,
            IOptions<AlpacaProxyOptions> proxyOpts,
            CancellationToken ct) =>
        {
            if (body.FromActivities == true)
            {
                var alpaca = alpacaOpts.Value;
                if (!alpaca.HasCredentials)
                {
                    return Results.Problem(
                        title: "Alpaca credentials not configured",
                        detail: "Cannot resolve from activities without credentials.",
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                var row = await outcomes.GetByClientOrderIdAsync(clientOrderId, ct);
                if (row is null)
                {
                    return Results.Problem(
                        title: "Outcome not found",
                        detail: $"No outcome for client_order_id={clientOrderId}.",
                        statusCode: StatusCodes.Status404NotFound);
                }

                var http = httpFactory.CreateClient(AlpacaProxyEndpoints.HttpClientName);
                var baseUrl = alpaca.TradingBaseUrl.TrimEnd('/');
                var url =
                    $"{baseUrl}/v2/account/activities?category=trade_activities&direction=desc";
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Add("APCA-API-KEY-ID", alpaca.ApiKeyId);
                req.Headers.Add("APCA-API-SECRET-KEY", alpaca.ApiSecretKey);

                try
                {
                    using var res = await http.SendAsync(req, ct);
                    var bytes = await res.Content.ReadAsByteArrayAsync(ct);
                    if (!res.IsSuccessStatusCode)
                    {
                        return Results.Problem(
                            title: "Upstream Alpaca activities failed",
                            detail: $"Alpaca returned {(int)res.StatusCode}.",
                            statusCode: StatusCodes.Status502BadGateway);
                    }

                    using var doc = JsonDocument.Parse(bytes);
                    var acts = new List<JsonElement>();
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                            acts.Add(el.Clone());
                    }

                    await outcomes.ResolveFromActivitiesAsync(clientOrderId, acts, ct);
                    row = await outcomes.GetByClientOrderIdAsync(clientOrderId, ct);
                    return Results.Ok(outcomes.ToDto(row!));
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    throw;
                }
                catch (OperationCanceledException)
                {
                    return Results.Problem(
                        title: "Upstream Alpaca request timed out",
                        detail: $"No response within {proxyOpts.Value.TimeoutSeconds}s.",
                        statusCode: StatusCodes.Status504GatewayTimeout);
                }
                catch (HttpRequestException ex)
                {
                    return Results.Problem(
                        title: "Upstream Alpaca request failed",
                        detail: ex.Message,
                        statusCode: StatusCodes.Status502BadGateway);
                }
            }

            var (ok, resolved, error) = await outcomes.ResolveAsync(clientOrderId, body, ct);
            if (!ok)
            {
                return Results.Problem(
                    title: "Resolve failed",
                    detail: error ?? "Unable to resolve.",
                    statusCode: StatusCodes.Status404NotFound);
            }

            return Results.Ok(outcomes.ToDto(resolved!));
        })
        .WithName("ResolveTradeOutcome")
        .WithTags("Trades")
        .Produces<TradeOutcomeDto>()
        .ProducesProblem(404)
        .ProducesProblem(502)
        .ProducesProblem(503)
        .ProducesProblem(504);

        app.MapGet("/api/trades/retrospective", async (
            ITradeOutcomeService outcomes,
            string? underlying,
            int? limit,
            CancellationToken ct) =>
        {
            var rows = await outcomes.ListAsync(
                underlying, outcomeLabel: null, resolvedOnly: null, limit ?? 500, ct);
            return Results.Ok(outcomes.BuildRetrospective(rows));
        })
        .WithName("GetTradeRetrospective")
        .WithTags("Trades")
        .Produces<RetrospectiveSummaryDto>();

        app.MapGet("/api/trades/outcomes.csv", async (
            ITradeOutcomeService outcomes,
            string? underlying,
            int? limit,
            CancellationToken ct) =>
        {
            var rows = await outcomes.ListAsync(
                underlying, outcomeLabel: null, resolvedOnly: true, limit ?? 500, ct);
            var csv = outcomes.ToCsv(rows);
            return Results.Text(csv, "text/csv");
        })
        .WithName("ExportTradeOutcomesCsv")
        .WithTags("Trades");

        return app;
    }
}
