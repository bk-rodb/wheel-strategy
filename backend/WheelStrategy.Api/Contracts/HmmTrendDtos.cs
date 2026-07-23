namespace WheelStrategy.Api.Contracts;

public record HmmStateSnapshot(
    string Date,
    IReadOnlyList<double> StateProbs,
    string DominantState);

public record HmmForecastHorizon(
    int Days,
    IReadOnlyList<double> StateProbs,
    double ExpectedReturnPct,
    double BearProb,
    double BullProb);

/// <summary>HMM regime analysis and multi-horizon trend forecast for a symbol.</summary>
public record HmmTrendResult(
    string Symbol,
    decimal CurrentPrice,
    DateTimeOffset AsOf,
    int LookbackDays,
    string Granularity,
    IReadOnlyList<string> StateLabels,
    IReadOnlyList<HmmStateSnapshot> History,
    IReadOnlyList<double> CurrentStateProbs,
    string CurrentRegime,
    IReadOnlyList<IReadOnlyList<double>> TransitionMatrix,
    IReadOnlyList<HmmForecastHorizon> Forecast,
    IReadOnlyList<double> StateMeans,
    IReadOnlyList<double> StateVols,
    IReadOnlyList<string> Warnings);
