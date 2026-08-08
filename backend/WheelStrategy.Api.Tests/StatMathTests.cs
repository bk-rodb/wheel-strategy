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

    [Fact]
    public void PutDelta_atm_is_negative()
    {
        var delta = StatMath.PutDelta(S, K, T, R, Sigma);
        Assert.InRange(delta, -0.45, -0.30);
    }

    [Fact]
    public void CallDelta_atm_is_positive()
    {
        var delta = StatMath.CallDelta(S, K, T, R, Sigma);
        Assert.InRange(delta, 0.55, 0.70);
    }

    [Fact]
    public void StrikeForPutAbsDelta_targets_30_delta()
    {
        const double t = 35.0 / 365.0;
        var k = StatMath.StrikeForPutAbsDelta(S, 0.30, t, R, Sigma);
        var delta = StatMath.PutDelta(S, k, t, R, Sigma);
        Assert.InRange(Math.Abs(delta), 0.28, 0.32);
    }

    [Fact]
    public void StrikeForCallDelta_targets_30_delta()
    {
        var k = StatMath.StrikeForCallDelta(S, 0.30, T, R, Sigma);
        var delta = StatMath.CallDelta(S, k, T, R, Sigma);
        Assert.InRange(delta, 0.29, 0.31);
        Assert.True(k > S);
    }

    [Fact]
    public void Atr_computes_wilder_smoothed_value()
    {
        var highs = new[] { 12.0, 13.0, 14.0, 13.5, 14.5, 15.0, 14.0, 15.5 };
        var lows = new[] { 10.0, 11.0, 12.0, 11.5, 12.5, 13.0, 12.0, 13.5 };
        var closes = new[] { 11.0, 12.0, 13.0, 12.5, 13.5, 14.0, 13.0, 14.5 };
        var atr = StatMath.Atr(highs, lows, closes, 3);
        Assert.True(atr > 0 && atr < 5);
    }
}
