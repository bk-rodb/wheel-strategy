using WheelStrategy.Api.Stats;

namespace WheelStrategy.Api.Tests;

public class GaussianHmmTests
{
    [Fact]
    public void ForecastCumulativeLogReturn_accumulates_along_path_not_terminal_times_H()
    {
        // Worked example from CODE_REVIEW H-14: π₀ = [1,0,0], μ = [-0.020, 0, +0.015],
        // 0.7 diagonal transition — correct 5-week cumulative ≈ -2.92%.
        var model = new GaussianHmm.Model(
            Start: [1.0, 0.0, 0.0],
            Transition:
            [
                [0.70, 0.15, 0.15],
                [0.15, 0.70, 0.15],
                [0.15, 0.15, 0.70],
            ],
            Means: [-0.020, 0.000, 0.015],
            Variances: [0.0004, 0.0004, 0.0004]);

        var current = new[] { 1.0, 0.0, 0.0 };
        var horizon = 5;

        var pathCum = GaussianHmm.ForecastCumulativeLogReturn(model, current, horizon);
        var pathPct = (Math.Exp(pathCum) - 1.0) * 100.0;

        // Old (wrong) formula: terminal-state mean × H
        var terminal = GaussianHmm.ForecastStateProbs(model, current, horizon);
        var wrongPct = (Math.Exp(GaussianHmm.ExpectedPeriodReturn(model, terminal) * horizon) - 1.0) * 100.0;

        Assert.InRange(pathPct, -3.1, -2.7);
        Assert.InRange(wrongPct, -1.5, -1.1);
        Assert.True(pathPct < wrongPct, "Path accumulation should be more negative than the old formula.");
    }

    [Fact]
    public void ForecastStateProbs_converges_toward_stationary_distribution()
    {
        var model = new GaussianHmm.Model(
            Start: [1.0, 0.0, 0.0],
            Transition:
            [
                [0.70, 0.15, 0.15],
                [0.15, 0.70, 0.15],
                [0.15, 0.15, 0.70],
            ],
            Means: [-0.02, 0.0, 0.02],
            Variances: [0.001, 0.001, 0.001]);

        var far = GaussianHmm.ForecastStateProbs(model, [1.0, 0.0, 0.0], 50);
        Assert.InRange(far[0], 0.30, 0.37);
        Assert.InRange(far[1], 0.30, 0.37);
        Assert.InRange(far[2], 0.30, 0.37);
    }

    [Fact]
    public void Fit_produces_finite_log_likelihood()
    {
        var rng = new Random(42);
        var obs = Enumerable.Range(0, 60)
            .Select(_ => rng.NextDouble() * 0.04 - 0.02)
            .ToList();

        var fit = GaussianHmm.Fit(obs);
        Assert.True(double.IsFinite(fit.LogLikelihood));
    }
}
