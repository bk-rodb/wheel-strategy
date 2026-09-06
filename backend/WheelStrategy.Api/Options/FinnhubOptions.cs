namespace WheelStrategy.Api.Options;

/// <summary>
/// Finnhub API key for earnings/dividend calendar. Optional — when empty the
/// catalysts endpoint falls back to macro-only events from the static schedule.
/// Set via Windows user environment variable FINNHUB_API_KEY
/// (see <see cref="UserEnvironmentSecrets"/>). User-secrets remain a silent fallback.
/// </summary>
public class FinnhubOptions
{
    public const string SectionName = "Finnhub";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://finnhub.io/api/v1";
}
