namespace WheelStrategy.Api.Stats;

/// <summary>
/// Pure double-precision statistics and Black-Scholes helpers. No external deps.
/// Note: .NET has no Math.Erf, so NormCdf uses the Abramowitz-Stegun 7.1.26
/// rational approximation.
/// </summary>
public static class StatMath
{
    /// <summary>Sample standard deviation (n-1). Returns 0 for &lt; 2 points.</summary>
    public static double StdDev(IReadOnlyList<double> xs)
    {
        if (xs.Count < 2) return 0;
        double mean = 0;
        for (int i = 0; i < xs.Count; i++) mean += xs[i];
        mean /= xs.Count;
        double sumSq = 0;
        for (int i = 0; i < xs.Count; i++)
        {
            var d = xs[i] - mean;
            sumSq += d * d;
        }
        return Math.Sqrt(sumSq / (xs.Count - 1));
    }

    /// <summary>
    /// Quantile via type-7 (R default) linear interpolation between order
    /// statistics. <paramref name="p"/> in [0,1]. <paramref name="sorted"/> must be ascending.
    /// </summary>
    public static double Quantile(IReadOnlyList<double> sorted, double p)
    {
        var n = sorted.Count;
        if (n == 0) return double.NaN;
        if (n == 1) return sorted[0];
        p = Math.Clamp(p, 0, 1);
        var h = (n - 1) * p;
        var lo = (int)Math.Floor(h);
        var hi = Math.Min(lo + 1, n - 1);
        var frac = h - lo;
        return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
    }

    /// <summary>Fraction of values strictly less than <paramref name="threshold"/>.</summary>
    public static double FractionBelow(IReadOnlyList<double> xs, double threshold)
    {
        if (xs.Count == 0) return double.NaN;
        int c = 0;
        for (int i = 0; i < xs.Count; i++) if (xs[i] < threshold) c++;
        return (double)c / xs.Count;
    }

    /// <summary>Fraction of values strictly greater than <paramref name="threshold"/>.</summary>
    public static double FractionAbove(IReadOnlyList<double> xs, double threshold)
    {
        if (xs.Count == 0) return double.NaN;
        int c = 0;
        for (int i = 0; i < xs.Count; i++) if (xs[i] > threshold) c++;
        return (double)c / xs.Count;
    }

    /// <summary>Standard normal CDF, N(x), via erf approximation.</summary>
    public static double NormCdf(double x) => 0.5 * (1.0 + Erf(x / Math.Sqrt(2.0)));

    /// <summary>Abramowitz &amp; Stegun 7.1.26 — |error| &lt; 1.5e-7.</summary>
    private static double Erf(double x)
    {
        var sign = Math.Sign(x);
        x = Math.Abs(x);
        const double a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
                     a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        var t = 1.0 / (1.0 + p * x);
        var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.Exp(-x * x);
        return sign * y;
    }

    public readonly record struct BlackScholes(double D1, double D2);

    /// <summary>d1/d2 for spot S, strike K, time T (years), rate r, annualized vol sigma.</summary>
    public static BlackScholes Bs(double s, double k, double t, double r, double sigma)
    {
        if (s <= 0 || k <= 0 || t <= 0 || sigma <= 0) return new BlackScholes(double.NaN, double.NaN);
        var d1 = (Math.Log(s / k) + (r + 0.5 * sigma * sigma) * t) / (sigma * Math.Sqrt(t));
        var d2 = d1 - sigma * Math.Sqrt(t);
        return new BlackScholes(d1, d2);
    }

    /// <summary>Prob a short put finishes ITM (assigned): N(-d2).</summary>
    public static double PutAssignmentProb(double s, double k, double t, double r, double sigma)
    {
        var bs = Bs(s, k, t, r, sigma);
        return double.IsNaN(bs.D2) ? double.NaN : NormCdf(-bs.D2);
    }

    /// <summary>Prob a short call finishes ITM (assigned): N(d2).</summary>
    public static double CallAssignmentProb(double s, double k, double t, double r, double sigma)
    {
        var bs = Bs(s, k, t, r, sigma);
        return double.IsNaN(bs.D2) ? double.NaN : NormCdf(bs.D2);
    }

    /// <summary>Black-Scholes call premium.</summary>
    public static double CallPrice(double s, double k, double t, double r, double sigma)
    {
        var bs = Bs(s, k, t, r, sigma);
        if (double.IsNaN(bs.D1)) return double.NaN;
        return s * NormCdf(bs.D1) - k * Math.Exp(-r * t) * NormCdf(bs.D2);
    }

    /// <summary>Black-Scholes put premium.</summary>
    public static double PutPrice(double s, double k, double t, double r, double sigma)
    {
        var bs = Bs(s, k, t, r, sigma);
        if (double.IsNaN(bs.D1)) return double.NaN;
        return k * Math.Exp(-r * t) * NormCdf(-bs.D2) - s * NormCdf(-bs.D1);
    }

    /// <summary>Put delta (long): N(d1) − 1, negative for OTM puts.</summary>
    public static double PutDelta(double s, double k, double t, double r, double sigma)
    {
        var bs = Bs(s, k, t, r, sigma);
        return double.IsNaN(bs.D1) ? double.NaN : NormCdf(bs.D1) - 1.0;
    }

    /// <summary>Call delta (long): N(d1).</summary>
    public static double CallDelta(double s, double k, double t, double r, double sigma)
    {
        var bs = Bs(s, k, t, r, sigma);
        return double.IsNaN(bs.D1) ? double.NaN : NormCdf(bs.D1);
    }

    /// <summary>
    /// Strike for a short put with |delta| ≈ <paramref name="targetAbsDelta"/>.
    /// Binary search on K below spot.
    /// </summary>
    public static double StrikeForPutAbsDelta(double s, double targetAbsDelta, double t, double r, double sigma)
    {
        if (s <= 0 || t <= 0 || sigma <= 0) return double.NaN;
        targetAbsDelta = Math.Clamp(targetAbsDelta, 0.01, 0.99);
        var lo = s * 0.5;
        var hi = s * 0.999;
        for (var i = 0; i < 64; i++)
        {
            var mid = (lo + hi) / 2.0;
            var delta = PutDelta(s, mid, t, r, sigma);
            if (double.IsNaN(delta)) return double.NaN;
            // OTM puts (K < S): |delta| rises as K approaches spot from below.
            if (Math.Abs(delta) > targetAbsDelta) hi = mid;
            else lo = mid;
        }
        return (lo + hi) / 2.0;
    }

    /// <summary>
    /// Strike for a short call with delta ≈ <paramref name="targetDelta"/>.
    /// Binary search on K above spot.
    /// </summary>
    public static double StrikeForCallDelta(double s, double targetDelta, double t, double r, double sigma)
    {
        if (s <= 0 || t <= 0 || sigma <= 0) return double.NaN;
        targetDelta = Math.Clamp(targetDelta, 0.01, 0.99);
        var lo = s * 1.001;
        var hi = s * 1.5;
        for (var i = 0; i < 64; i++)
        {
            var mid = (lo + hi) / 2.0;
            var delta = CallDelta(s, mid, t, r, sigma);
            if (double.IsNaN(delta)) return double.NaN;
            if (delta > targetDelta) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2.0;
    }

    /// <summary>True range for one bar. <paramref name="prevClose"/> is ignored when NaN.</summary>
    public static double TrueRange(double high, double low, double prevClose)
    {
        if (!double.IsFinite(prevClose))
            return high - low;
        return Math.Max(high - low, Math.Max(Math.Abs(high - prevClose), Math.Abs(low - prevClose)));
    }

    /// <summary>
    /// Wilder-smoothed ATR over <paramref name="period"/> bars.
    /// <paramref name="highs"/>, <paramref name="lows"/>, <paramref name="closes"/> must align.
    /// </summary>
    public static double Atr(IReadOnlyList<double> highs, IReadOnlyList<double> lows,
        IReadOnlyList<double> closes, int period)
    {
        var n = Math.Min(highs.Count, Math.Min(lows.Count, closes.Count));
        if (n < period || period < 1) return double.NaN;

        var tr = new double[n];
        for (var i = 0; i < n; i++)
        {
            var prevClose = i > 0 ? closes[i - 1] : double.NaN;
            tr[i] = TrueRange(highs[i], lows[i], prevClose);
        }

        double atr = 0;
        for (var i = 0; i < period; i++) atr += tr[i];
        atr /= period;

        for (var i = period; i < n; i++)
            atr = (atr * (period - 1) + tr[i]) / period;

        return atr;
    }
}
