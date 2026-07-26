using WheelStrategy.Api.Stats;

namespace WheelStrategy.Api.Tests;

/// <summary>
/// Golden-value tests for Black-Scholes and core StatMath helpers.
/// Reference: Hull "Options, Futures, and Other Derivatives" standard inputs.
/// </summary>
public class StatMathTests
{
    private const double S = 100.0;
    private const double K = 100.0;
    private const double T = 1.0;
    private const double R = 0.05;
    private const double Sigma = 0.20;

    [Fact]
    public void PutPrice_matches_published_reference()
    {
        var price = StatMath.PutPrice(S, K, T, R, Sigma);
        Assert.InRange(price, 5.56, 5.58);
    }

    [Fact]
    public void CallPrice_matches_published_reference()
    {
        var price = StatMath.CallPrice(S, K, T, R, Sigma);
        Assert.InRange(price, 10.44, 10.46);
    }

    [Fact]
    public void PutAssignmentProb_matches_N_minus_d2()
    {
        var prob = StatMath.PutAssignmentProb(S, K, T, R, Sigma);
        Assert.InRange(prob, 0.43, 0.45);
    }

    [Fact]
    public void CallAssignmentProb_matches_N_d2()
    {
        var prob = StatMath.CallAssignmentProb(S, K, T, R, Sigma);
        Assert.InRange(prob, 0.55, 0.57);
    }

    [Fact]
    public void PutCall_parity_holds()
    {
        var call = StatMath.CallPrice(S, K, T, R, Sigma);
        var put = StatMath.PutPrice(S, K, T, R, Sigma);
        var parity = call - put - S + K * Math.Exp(-R * T);
        Assert.InRange(parity, -0.01, 0.01);
    }

    [Fact]
    public void Bs_returns_NaN_for_invalid_inputs()
    {
        var bs = StatMath.Bs(0, K, T, R, Sigma);
        Assert.True(double.IsNaN(bs.D1));
        Assert.True(double.IsNaN(bs.D2));
    }

    [Fact]
    public void Quantile_type7_interpolates_correctly()
    {
        var sorted = new[] { 1.0, 2.0, 3.0, 4.0 };
        Assert.Equal(2.5, StatMath.Quantile(sorted, 0.5), 3);
    }

    [Fact]
    public void StdDev_uses_sample_divisor()
    {
        var xs = new[] { 2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0 };
        // Sample std dev with n-1 divisor: sqrt(32/7) ≈ 2.138
        Assert.InRange(StatMath.StdDev(xs), 2.12, 2.16);
    }
}
