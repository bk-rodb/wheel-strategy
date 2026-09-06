using Microsoft.Extensions.Configuration;
using WheelStrategy.Api.Options;

namespace WheelStrategy.Api.Tests;

public class AlpacaCredentialAliasesTests
{
    [Fact]
    public void Apply_fills_blank_Alpaca_keys_from_ALPACA_env_aliases()
    {
        var config = new ConfigurationManager();

        AlpacaCredentialAliases.Apply(config, name => name switch
        {
            AlpacaCredentialAliases.ApiKeyIdEnv => "PK_FROM_ENV",
            AlpacaCredentialAliases.ApiSecretKeyEnv => "SECRET_FROM_ENV",
            _ => null,
        });

        Assert.Equal("PK_FROM_ENV", config["Alpaca:ApiKeyId"]);
        Assert.Equal("SECRET_FROM_ENV", config["Alpaca:ApiSecretKey"]);
    }

    [Fact]
    public void Apply_does_not_override_configured_Alpaca_keys()
    {
        var config = new ConfigurationManager();
        config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Alpaca:ApiKeyId"] = "PK_CONFIGURED",
            ["Alpaca:ApiSecretKey"] = "SECRET_CONFIGURED",
        });

        AlpacaCredentialAliases.Apply(config, name => name switch
        {
            AlpacaCredentialAliases.ApiKeyIdEnv => "PK_FROM_ENV",
            AlpacaCredentialAliases.ApiSecretKeyEnv => "SECRET_FROM_ENV",
            _ => null,
        });

        Assert.Equal("PK_CONFIGURED", config["Alpaca:ApiKeyId"]);
        Assert.Equal("SECRET_CONFIGURED", config["Alpaca:ApiSecretKey"]);
    }

    [Fact]
    public void Apply_ignores_missing_or_blank_aliases()
    {
        var config = new ConfigurationManager();

        AlpacaCredentialAliases.Apply(config, name => name switch
        {
            AlpacaCredentialAliases.ApiKeyIdEnv => "  ",
            AlpacaCredentialAliases.ApiSecretKeyEnv => null,
            _ => null,
        });

        Assert.True(string.IsNullOrEmpty(config["Alpaca:ApiKeyId"]));
        Assert.True(string.IsNullOrEmpty(config["Alpaca:ApiSecretKey"]));
    }
}
