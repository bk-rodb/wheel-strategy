using System.Text.RegularExpressions;

namespace WheelStrategy.Api.Orders;

/// <summary>OSI helpers shared by the order journal (mirrors frontend optionOrders).</summary>
public static partial class OptionSymbol
{
    [GeneratedRegex(@"^[A-Z]{1,6}\d{6}[CP]\d{8}$", RegexOptions.CultureInvariant)]
    private static partial Regex CompactOsiRegex { get; }

    /// <summary>Best-effort underlying from OSI (padded or compact).</summary>
    public static string UnderlyingFromOsi(string osi)
    {
        var compact = osi.Replace(" ", "", StringComparison.Ordinal).ToUpperInvariant();
        if (compact.Length >= 15 && CompactOsiRegex.IsMatch(compact))
            return compact[..^15];

        var parts = osi.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[0].ToUpperInvariant() : osi.ToUpperInvariant();
    }

    /// <summary>put | call from compact OSI (C/P before 8-digit strike).</summary>
    public static string OptionRightFromOsi(string osi)
    {
        var compact = osi.Replace(" ", "", StringComparison.Ordinal).ToUpperInvariant();
        if (compact.Length >= 15 && CompactOsiRegex.IsMatch(compact))
        {
            var cp = compact[^9];
            return cp == 'C' ? "call" : cp == 'P' ? "put" : "";
        }
        return "";
    }
}
