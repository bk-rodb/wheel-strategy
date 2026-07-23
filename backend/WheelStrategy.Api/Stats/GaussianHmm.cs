namespace WheelStrategy.Api.Stats;

/// <summary>
/// 3-state Gaussian hidden Markov model fit via Baum-Welch EM. States are relabeled
/// ascending by emission mean (bear → neutral → bull) after fitting.
/// </summary>
public static class GaussianHmm
{
    public const int NumStates = 3;
    public static readonly string[] StateLabels = ["bear", "neutral", "bull"];

    public record Model(
        double[] Start,
        double[][] Transition,
        double[] Means,
        double[] Variances);

    public record FitResult(
        Model Model,
        double[][] StateProbs,
        int[] ViterbiPath,
        double LogLikelihood);

    public static FitResult Fit(IReadOnlyList<double> observations, int maxIter = 80, double tol = 1e-5)
    {
        var T = observations.Count;
        if (T < 20)
            throw new ArgumentException($"Need at least 20 observations for HMM fit (got {T}).");

        var obs = observations.ToArray();
        var sorted = obs.OrderBy(x => x).ToArray();
        var n = sorted.Length;
        var means = new[] { sorted[n / 6], sorted[n / 2], sorted[Math.Min(5 * n / 6, n - 1)] };
        var overallVar = Math.Max(StatMath.StdDev(obs) * StatMath.StdDev(obs), 1e-10);
        var vars = new[] { overallVar, overallVar, overallVar };

        var start = Enumerable.Repeat(1.0 / NumStates, NumStates).ToArray();
        var transition = Enumerable.Range(0, NumStates)
            .Select(i => Enumerable.Range(0, NumStates).Select(j => i == j ? 0.70 : 0.15).ToArray())
            .ToArray();

        double[][] gamma = new double[T][];
        double prevLl = double.NegativeInfinity;

        for (var iter = 0; iter < maxIter; iter++)
        {
            var (alpha, scale) = Forward(obs, start, transition, means, vars);
            var beta = Backward(obs, transition, means, vars, scale);
            gamma = new double[T][];
            for (var t = 0; t < T; t++)
            {
                gamma[t] = new double[NumStates];
                for (var i = 0; i < NumStates; i++)
                    gamma[t][i] = alpha[t][i] * beta[t][i];
                Normalize(gamma[t]);
            }

            var xi = new double[T - 1][][];
            for (var t = 0; t < T - 1; t++)
            {
                xi[t] = new double[NumStates][];
                for (var i = 0; i < NumStates; i++)
                {
                    xi[t][i] = new double[NumStates];
                    for (var j = 0; j < NumStates; j++)
                        xi[t][i][j] = alpha[t][i] * transition[i][j] * Emission(obs[t + 1], means[j], vars[j]) * beta[t + 1][j];
                }
                var sum = 0.0;
                for (var i = 0; i < NumStates; i++)
                    for (var j = 0; j < NumStates; j++)
                        sum += xi[t][i][j];
                if (sum > 0)
                    for (var i = 0; i < NumStates; i++)
                        for (var j = 0; j < NumStates; j++)
                            xi[t][i][j] /= sum;
            }

            var ll = -scale.Sum(Math.Log);
            if (iter > 0 && Math.Abs(ll - prevLl) < tol) break;
            prevLl = ll;

            for (var i = 0; i < NumStates; i++)
            {
                start[i] = gamma[0][i];
            }
            Normalize(start);

            for (var i = 0; i < NumStates; i++)
            {
                var denom = 0.0;
                for (var t = 0; t < T - 1; t++)
                    for (var j = 0; j < NumStates; j++)
                        denom += xi[t][i][j];

                if (denom < 1e-12)
                {
                    for (var j = 0; j < NumStates; j++)
                        transition[i][j] = i == j ? 0.7 : 0.15;
                    continue;
                }

                for (var j = 0; j < NumStates; j++)
                {
                    var num = 0.0;
                    for (var t = 0; t < T - 1; t++)
                        num += xi[t][i][j];
                    transition[i][j] = num / denom;
                }
                Normalize(transition[i]);
            }

            for (var j = 0; j < NumStates; j++)
            {
                var weight = 0.0;
                var mean = 0.0;
                for (var t = 0; t < T; t++)
                {
                    weight += gamma[t][j];
                    mean += gamma[t][j] * obs[t];
                }
                means[j] = weight > 1e-12 ? mean / weight : means[j];
            }

            for (var j = 0; j < NumStates; j++)
            {
                var weight = 0.0;
                var varSum = 0.0;
                for (var t = 0; t < T; t++)
                {
                    var d = obs[t] - means[j];
                    varSum += gamma[t][j] * d * d;
                    weight += gamma[t][j];
                }
                vars[j] = weight > 1e-12 ? Math.Max(varSum / weight, 1e-10) : vars[j];
            }
        }

        var model = new Model(start, transition, means, vars);
        var relabeled = RelabelByMean(model, gamma);
        var viterbi = Viterbi(obs, relabeled.Model.Start, relabeled.Model.Transition, relabeled.Model.Means, relabeled.Model.Variances);
        return new FitResult(relabeled.Model, relabeled.StateProbs, viterbi, prevLl);
    }

    /// <summary>State distribution after <paramref name="steps"/> Markov transitions.</summary>
    public static double[] ForecastStateProbs(Model model, IReadOnlyList<double> current, int steps)
    {
        var p = current.ToArray();
        for (var s = 0; s < steps; s++)
            p = StepTransition(p, model.Transition);
        return p;
    }

    public static double ExpectedPeriodReturn(Model model, IReadOnlyList<double> stateProbs)
    {
        var sum = 0.0;
        for (var i = 0; i < NumStates; i++)
            sum += stateProbs[i] * model.Means[i];
        return sum;
    }

    private static FitResult RelabelByMean(Model model, double[][] gamma)
    {
        var order = Enumerable.Range(0, NumStates).OrderBy(i => model.Means[i]).ToArray();
        if (order.SequenceEqual(Enumerable.Range(0, NumStates)))
            return new FitResult(model, gamma, Array.Empty<int>(), 0);

        var newStart = order.Select(i => model.Start[i]).ToArray();
        var newTrans = order.Select(i =>
            order.Select(j => model.Transition[i][j]).ToArray()).ToArray();
        var newMeans = order.Select(i => model.Means[i]).ToArray();
        var newVars = order.Select(i => model.Variances[i]).ToArray();
        var newGamma = gamma.Select(row => order.Select(i => row[i]).ToArray()).ToArray();

        return new FitResult(
            new Model(newStart, newTrans, newMeans, newVars),
            newGamma,
            Array.Empty<int>(),
            0);
    }

    private static double[] StepTransition(double[] probs, double[][] transition)
    {
        var next = new double[NumStates];
        for (var j = 0; j < NumStates; j++)
            for (var i = 0; i < NumStates; i++)
                next[j] += probs[i] * transition[i][j];
        return next;
    }

    private static (double[][] Alpha, double[] Scale) Forward(
        double[] obs, double[] start, double[][] transition, double[] means, double[] vars)
    {
        var T = obs.Length;
        var alpha = new double[T][];
        var scale = new double[T];

        alpha[0] = new double[NumStates];
        for (var i = 0; i < NumStates; i++)
            alpha[0][i] = start[i] * Emission(obs[0], means[i], vars[i]);
        scale[0] = Normalize(alpha[0]);

        for (var t = 1; t < T; t++)
        {
            alpha[t] = new double[NumStates];
            for (var j = 0; j < NumStates; j++)
            {
                var sum = 0.0;
                for (var i = 0; i < NumStates; i++)
                    sum += alpha[t - 1][i] * transition[i][j];
                alpha[t][j] = sum * Emission(obs[t], means[j], vars[j]);
            }
            scale[t] = Normalize(alpha[t]);
        }

        return (alpha, scale);
    }

    private static double[][] Backward(double[] obs, double[][] transition, double[] means, double[] vars, double[] scale)
    {
        var T = obs.Length;
        var beta = new double[T][];
        beta[T - 1] = Enumerable.Repeat(1.0 / scale[T - 1], NumStates).ToArray();

        for (var t = T - 2; t >= 0; t--)
        {
            beta[t] = new double[NumStates];
            for (var i = 0; i < NumStates; i++)
            {
                var sum = 0.0;
                for (var j = 0; j < NumStates; j++)
                    sum += transition[i][j] * Emission(obs[t + 1], means[j], vars[j]) * beta[t + 1][j];
                beta[t][i] = sum / scale[t];
            }
        }

        return beta;
    }

    private static int[] Viterbi(double[] obs, double[] start, double[][] transition, double[] means, double[] vars)
    {
        var T = obs.Length;
        var delta = new double[T][];
        var psi = new int[T][];

        delta[0] = new double[NumStates];
        psi[0] = new int[NumStates];
        for (var i = 0; i < NumStates; i++)
            delta[0][i] = Math.Log(start[i]) + Math.Log(Emission(obs[0], means[i], vars[i]));

        for (var t = 1; t < T; t++)
        {
            delta[t] = new double[NumStates];
            psi[t] = new int[NumStates];
            for (var j = 0; j < NumStates; j++)
            {
                var best = double.NegativeInfinity;
                var bestI = 0;
                for (var i = 0; i < NumStates; i++)
                {
                    var score = delta[t - 1][i] + Math.Log(transition[i][j]);
                    if (score > best) { best = score; bestI = i; }
                }
                delta[t][j] = best + Math.Log(Emission(obs[t], means[j], vars[j]));
                psi[t][j] = bestI;
            }
        }

        var path = new int[T];
        path[T - 1] = ArgMax(delta[T - 1]);
        for (var t = T - 2; t >= 0; t--)
            path[t] = psi[t + 1][path[t + 1]];
        return path;
    }

    private static double Emission(double x, double mean, double variance)
    {
        var v = Math.Max(variance, 1e-10);
        var d = x - mean;
        return Math.Exp(-0.5 * d * d / v) / Math.Sqrt(2.0 * Math.PI * v);
    }

    private static double Normalize(double[] xs)
    {
        var sum = xs.Sum();
        if (sum <= 0)
        {
            var u = 1.0 / xs.Length;
            for (var i = 0; i < xs.Length; i++) xs[i] = u;
            return 1.0;
        }
        for (var i = 0; i < xs.Length; i++) xs[i] /= sum;
        return sum;
    }

    private static int ArgMax(double[] xs)
    {
        var best = 0;
        for (var i = 1; i < xs.Length; i++)
            if (xs[i] > xs[best]) best = i;
        return best;
    }
}
