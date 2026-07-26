using WheelStrategy.Api.Endpoints;

namespace WheelStrategy.Api.Tests;

public class AnalysisQueryTests
{
    [Theory]
    [InlineData(null, "NVDA")]
    [InlineData("", "NVDA")]
    [InlineData("  aapl  ", "AAPL")]
    [InlineData("BRK.B", "BRK.B")]
    [InlineData("BF-B", "BF-B")]
    public void TryNormalizeSymbol_accepts_valid(string? input, string expected)
    {
        Assert.True(AnalysisQuery.TryNormalizeSymbol(input, out var sym, out var err));
        Assert.Null(err);
        Assert.Equal(expected, sym);
    }

    [Theory]
    [InlineData("1ABC")]
    [InlineData("TOOLONGSYM1")]
    [InlineData("AA BB")]
    [InlineData("../etc")]
    [InlineData("AAPL;DROP")]
    public void TryNormalizeSymbol_rejects_invalid(string input)
    {
        Assert.False(AnalysisQuery.TryNormalizeSymbol(input, out var sym, out var err));
        Assert.Equal(string.Empty, sym);
        Assert.False(string.IsNullOrWhiteSpace(err));
    }

    [Fact]
    public void ResolveLookbackDays_clamps_overflow()
    {
        Assert.Equal(3650, AnalysisQuery.ResolveLookbackDays(2_000_000_000, 730, 3650));
        Assert.Equal(730, AnalysisQuery.ResolveLookbackDays(null, 730, 3650));
        Assert.Equal(730, AnalysisQuery.ResolveLookbackDays(0, 730, 3650));
        Assert.Equal(730, AnalysisQuery.ResolveLookbackDays(-5, 730, 3650));
        Assert.Equal(90, AnalysisQuery.ResolveLookbackDays(90, 730, 3650));
        Assert.Equal(1, AnalysisQuery.ResolveLookbackDays(1, 730, 3650));
    }

    [Fact]
    public void ResolveDte_clamps_to_max()
    {
        Assert.Equal(730, AnalysisQuery.ResolveDte(10_000, 35, 730));
        Assert.Equal(35, AnalysisQuery.ResolveDte(null, 35, 730));
        Assert.Equal(21, AnalysisQuery.ResolveDte(21, 35, 730));
    }
}
