using System.Text.RegularExpressions;

namespace WheelStrategy.Api.Endpoints;

/// <summary>
/// Shared query validation/clamping for analysis and catalysts endpoints (H-20).
/// </summary>
public static partial class AnalysisQuery
{
    /// <summary>1–10 char equity/ETF root: letter first, then letters/digits/./-.</summary>
    [GeneratedRegex(@"^[A-Za-z][A-Za-z0-9.\-]{0,9}$", RegexOptions.CultureInvariant)]
    private static partial Regex SymbolPattern();

    public static bool TryNormalizeSymbol(string? symbol, out string normalized, out string? error)
    {
        if (string.IsNullOrWhiteSpace(symbol))
        {
            normalized = "NVDA";
            error = null;
            return true;
        }

        var trimmed = symbol.Trim();
        if (!SymbolPattern().IsMatch(trimmed))
        {
            normalized = string.Empty;
            error = "symbol must be 1–10 characters: letter first, then letters, digits, '.', or '-'.";
            return false;
        }

        normalized = trimmed.ToUpperInvariant();
        error = null;
        return true;
    }

    public static int ResolveLookbackDays(int? lookbackDays, int defaultDays, int maxDays)
    {
        if (lookbackDays is null or <= 0)
            return Math.Clamp(defaultDays, 1, maxDays);
        return Math.Clamp(lookbackDays.Value, 1, maxDays);
    }

    public static int ResolveDte(int? dte, int defaultDte, int maxDte)
    {
        if (dte is null or <= 0)
            return Math.Clamp(defaultDte, 1, maxDte);
        return Math.Clamp(dte.Value, 1, maxDte);
    }

    public static string ResolveGranularity(string? granularity) =>
        string.IsNullOrWhiteSpace(granularity) ? "weekly" : granularity.Trim();
}
