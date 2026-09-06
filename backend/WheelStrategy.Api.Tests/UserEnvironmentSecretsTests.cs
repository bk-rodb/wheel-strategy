using WheelStrategy.Api.Options;

namespace WheelStrategy.Api.Tests;

public class UserEnvironmentSecretsTests
{
    [Fact]
    public void Overlay_Alpaca_sets_both_fields_from_env()
    {
        var opts = new AlpacaOptions { ApiKeyId = "from-secrets", ApiSecretKey = "from-secrets" };
        UserEnvironmentSecrets.Overlay(opts, name => name switch
        {
            UserEnvironmentSecrets.AlpacaApiKeyId => "env-key-id",
            UserEnvironmentSecrets.AlpacaApiSecretKey => "env-secret",
            _ => null,
        });

        Assert.Equal("env-key-id", opts.ApiKeyId);
        Assert.Equal("env-secret", opts.ApiSecretKey);
    }

    [Fact]
    public void Overlay_Alpaca_blank_or_missing_leaves_existing()
    {
        var opts = new AlpacaOptions { ApiKeyId = "kept-id", ApiSecretKey = "kept-secret" };
        UserEnvironmentSecrets.Overlay(opts, name => name switch
        {
            UserEnvironmentSecrets.AlpacaApiKeyId => "   ",
            UserEnvironmentSecrets.AlpacaApiSecretKey => null,
            _ => throw new ArgumentOutOfRangeException(name),
        });

        Assert.Equal("kept-id", opts.ApiKeyId);
        Assert.Equal("kept-secret", opts.ApiSecretKey);
    }

    [Fact]
    public void Overlay_Alpaca_can_set_one_field_without_the_other()
    {
        var opts = new AlpacaOptions { ApiKeyId = "old-id", ApiSecretKey = "old-secret" };
        UserEnvironmentSecrets.Overlay(opts, name => name switch
        {
            UserEnvironmentSecrets.AlpacaApiKeyId => "new-id",
            UserEnvironmentSecrets.AlpacaApiSecretKey => "",
            _ => null,
        });

        Assert.Equal("new-id", opts.ApiKeyId);
        Assert.Equal("old-secret", opts.ApiSecretKey);
    }

    [Fact]
    public void Overlay_Finnhub_sets_from_env()
    {
        var opts = new FinnhubOptions { ApiKey = "from-secrets" };
        UserEnvironmentSecrets.Overlay(opts, name =>
            name == UserEnvironmentSecrets.FinnhubApiKey ? "env-finnhub" : null);

        Assert.Equal("env-finnhub", opts.ApiKey);
    }

    [Fact]
    public void Overlay_Finnhub_blank_or_missing_leaves_existing()
    {
        var opts = new FinnhubOptions { ApiKey = "kept" };
        UserEnvironmentSecrets.Overlay(opts, _ => null);
        Assert.Equal("kept", opts.ApiKey);

        UserEnvironmentSecrets.Overlay(opts, _ => "  ");
        Assert.Equal("kept", opts.ApiKey);
    }

    [Fact]
    public void Overlay_Alpaca_from_process_environment()
    {
        var key = UserEnvironmentSecrets.AlpacaApiKeyId;
        var secret = UserEnvironmentSecrets.AlpacaApiSecretKey;
        var prevKey = Environment.GetEnvironmentVariable(key);
        var prevSecret = Environment.GetEnvironmentVariable(secret);
        try
        {
            Environment.SetEnvironmentVariable(key, "proc-id");
            Environment.SetEnvironmentVariable(secret, "proc-secret");
            var opts = new AlpacaOptions();
            UserEnvironmentSecrets.Overlay(opts);
            Assert.Equal("proc-id", opts.ApiKeyId);
            Assert.Equal("proc-secret", opts.ApiSecretKey);
        }
        finally
        {
            Environment.SetEnvironmentVariable(key, prevKey);
            Environment.SetEnvironmentVariable(secret, prevSecret);
        }
    }
}
