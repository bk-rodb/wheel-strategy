using Microsoft.Extensions.Configuration;

namespace WheelStrategy.Api.Options;

/// <summary>
/// Maps common flat Alpaca env names onto the <c>Alpaca:</c> options section.
/// User-secrets and <c>Alpaca__ApiKeyId</c> still win when they are set.
/// </summary>
public static class AlpacaCredentialAliases
{
    public const string ApiKeyIdEnv = "ALPACA_API_KEY_ID";
    public const string ApiSecretKeyEnv = "ALPACA_API_SECRET_KEY";

    public static void Apply(IConfigurationManager config, Func<string, string?>? getEnv = null)
    {
        getEnv ??= Environment.GetEnvironmentVariable;
        FillIfEmpty(config, "Alpaca:ApiKeyId", getEnv(ApiKeyIdEnv));
        FillIfEmpty(config, "Alpaca:ApiSecretKey", getEnv(ApiSecretKeyEnv));
    }

    private static void FillIfEmpty(IConfigurationManager config, string key, string? value)
    {
        if (!string.IsNullOrWhiteSpace(config[key]) || string.IsNullOrWhiteSpace(value))
            return;

        config.AddInMemoryCollection(new Dictionary<string, string?> { [key] = value });
    }
}
