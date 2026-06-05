namespace WheelStrategy.Api.Options;

/// <summary>
/// Alpaca market-data config. The base URL and feed are non-secret and live in
/// appsettings; the API key/secret are pulled from user-secrets or environment
/// variables (never committed, never the browser's VITE_ keys).
/// </summary>
public class AlpacaOptions
{
    public const string SectionName = "Alpaca";

    public string DataBaseUrl { get; set; } = "https://data.alpaca.markets";
    public string Feed { get; set; } = "iex";
    public string ApiKeyId { get; set; } = string.Empty;
    public string ApiSecretKey { get; set; } = string.Empty;
}
