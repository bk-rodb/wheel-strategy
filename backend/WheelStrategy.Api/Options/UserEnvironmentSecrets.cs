namespace WheelStrategy.Api.Options;

/// <summary>
/// Overlays broker/API credentials from Windows user (or process) environment
/// variables named ALL_CAPS_UNDERSCORE. Applied after appsettings / user-secrets
/// bind so a set env var wins; blank or missing leaves the bound value (silent
/// user-secrets fallback during migration).
/// </summary>
public static class UserEnvironmentSecrets
{
    public const string AlpacaApiKeyId = "ALPACA_API_KEY_ID";
    public const string AlpacaApiSecretKey = "ALPACA_API_SECRET_KEY";
    public const string FinnhubApiKey = "FINNHUB_API_KEY";

    public static void Overlay(AlpacaOptions opts) =>
        Overlay(opts, Environment.GetEnvironmentVariable);

    public static void Overlay(FinnhubOptions opts) =>
        Overlay(opts, Environment.GetEnvironmentVariable);

    public static void Overlay(AlpacaOptions opts, Func<string, string?> getEnv)
    {
        ArgumentNullException.ThrowIfNull(opts);
        ArgumentNullException.ThrowIfNull(getEnv);

        var id = getEnv(AlpacaApiKeyId);
        var secret = getEnv(AlpacaApiSecretKey);
        if (!string.IsNullOrWhiteSpace(id)) opts.ApiKeyId = id;
        if (!string.IsNullOrWhiteSpace(secret)) opts.ApiSecretKey = secret;
    }

    public static void Overlay(FinnhubOptions opts, Func<string, string?> getEnv)
    {
        ArgumentNullException.ThrowIfNull(opts);
        ArgumentNullException.ThrowIfNull(getEnv);

        var key = getEnv(FinnhubApiKey);
        if (!string.IsNullOrWhiteSpace(key)) opts.ApiKey = key;
    }

    public static IServiceCollection AddUserEnvironmentSecrets(this IServiceCollection services)
    {
        services.PostConfigure<AlpacaOptions>(Overlay);
        services.PostConfigure<FinnhubOptions>(Overlay);
        return services;
    }
}
