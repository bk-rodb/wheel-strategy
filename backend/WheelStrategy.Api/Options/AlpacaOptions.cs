namespace WheelStrategy.Api.Options;

/// <summary>
/// Alpaca config shared by the analysis services and the browser-facing proxy.
/// Base URLs and feed are non-secret and live in appsettings; the API key/secret
/// come from Windows user environment variables <c>ALPACA_API_KEY_ID</c> and
/// <c>ALPACA_API_SECRET_KEY</c> (see <see cref="UserEnvironmentSecrets"/>).
/// User-secrets remain a silent fallback. These are the only Alpaca credentials
/// in the system — the browser bundle holds none.
/// </summary>
public class AlpacaOptions
{
    public const string SectionName = "Alpaca";

    public string DataBaseUrl { get; set; } = "https://data.alpaca.markets";

    /// <summary>
    /// Trading API root. Paper by default; switching this to api.alpaca.markets
    /// is what makes the proxy trade live money.
    /// </summary>
    public string TradingBaseUrl { get; set; } = "https://paper-api.alpaca.markets";

    public string Feed { get; set; } = "iex";
    public string ApiKeyId { get; set; } = string.Empty;
    public string ApiSecretKey { get; set; } = string.Empty;

    public bool HasCredentials =>
        !string.IsNullOrWhiteSpace(ApiKeyId) && !string.IsNullOrWhiteSpace(ApiSecretKey);
}
