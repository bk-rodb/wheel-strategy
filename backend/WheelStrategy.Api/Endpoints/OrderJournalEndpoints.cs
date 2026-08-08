using System.Text.Json;
using Microsoft.Extensions.Options;
using WheelStrategy.Api.Alpaca;
using WheelStrategy.Api.Contracts;
using WheelStrategy.Api.Options;
using WheelStrategy.Api.Orders;

namespace WheelStrategy.Api.Endpoints;

public static class OrderJournalEndpoints
{
    public static IEndpointRouteBuilder MapOrderJournalEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/orders/journal", async (
            IOrderJournalService journal,
            string? underlying,
            bool? openOnly,
            int? limit,
            CancellationToken ct) =>
        {
            var rows = await journal.ListAsync(
                underlying,
                openOnly ?? true,
                limit ?? 50,
                ct);
            return Results.Ok(new OrderJournalListResponse(rows.Select(journal.ToDto).ToList()));
        })
        .WithName("ListOrderJournal")
        .WithTags("Orders")
        .Produces<OrderJournalListResponse>();

        app.MapPost("/api/orders/journal/{clientOrderId}/reconcile", async (
            string clientOrderId,
            IOrderJournalService journal,
            IHttpClientFactory httpFactory,
            IOptions<AlpacaOptions> alpacaOpts,
            IOptions<AlpacaProxyOptions> proxyOpts,
            ILoggerFactory logFactory,
            CancellationToken ct) =>
        {
            var log = logFactory.CreateLogger("WheelStrategy.Api.Endpoints.OrderJournal");
            var alpaca = alpacaOpts.Value;
            if (!alpaca.HasCredentials)
            {
                return Results.Problem(
                    title: "Alpaca credentials not configured",
                    detail: "Cannot reconcile without Alpaca credentials.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var entry = await journal.GetByClientOrderIdAsync(clientOrderId, ct);
            if (entry is null)
            {
                return Results.Problem(
                    title: "Journal entry not found",
                    detail: $"No journal row for client_order_id={clientOrderId}.",
                    statusCode: StatusCodes.Status404NotFound);
            }

            var http = httpFactory.CreateClient(AlpacaProxyEndpoints.HttpClientName);
            var baseUrl = alpaca.TradingBaseUrl.TrimEnd('/');

            string path;
            if (!string.IsNullOrEmpty(entry.AlpacaOrderId))
                path = $"v2/orders/{entry.AlpacaOrderId}";
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
                    if (JournalDeskStates.IsOpen(entry.DeskState)
                        && entry.DeskState is JournalDeskStates.Submitting
                            or JournalDeskStates.OrphanCheck)
                    {
                        await journal.MarkSubmitFailedAsync(
                            clientOrderId, "Reconcile: order not found at broker", ct);
                    }

                    entry = await journal.GetByClientOrderIdAsync(clientOrderId, ct);
                    return Results.Ok(journal.ToDto(entry!));
                }

                if (!res.IsSuccessStatusCode)
                {
                    log.LogWarning(
                        "Reconcile upstream {Status} for {ClientOrderId}",
                        (int)res.StatusCode, clientOrderId);
                    return Results.Problem(
                        title: "Upstream Alpaca reconcile failed",
                        detail: $"Alpaca returned {(int)res.StatusCode}.",
                        statusCode: StatusCodes.Status502BadGateway);
                }

                using var doc = JsonDocument.Parse(bytes);
                await journal.ApplyBrokerOrderJsonAsync(clientOrderId, doc.RootElement, ct: ct);
                entry = await journal.GetByClientOrderIdAsync(clientOrderId, ct);
                return Results.Ok(journal.ToDto(entry!));
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
        .WithName("ReconcileOrderJournal")
        .WithTags("Orders")
        .Produces<OrderJournalDto>()
        .ProducesProblem(404)
        .ProducesProblem(502)
        .ProducesProblem(503)
        .ProducesProblem(504);

        return app;
    }
}
