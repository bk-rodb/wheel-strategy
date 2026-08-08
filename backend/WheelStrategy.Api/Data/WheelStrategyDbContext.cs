using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Models;

namespace WheelStrategy.Api.Data;

public class WheelStrategyDbContext(DbContextOptions<WheelStrategyDbContext> options)
    : DbContext(options)
{
    public DbSet<HistoricalBar> HistoricalBars => Set<HistoricalBar>();
    public DbSet<OrderJournalEntry> OrderJournalEntries => Set<OrderJournalEntry>();
    public DbSet<TradeOutcome> TradeOutcomes => Set<TradeOutcome>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // HistoricalBar — cached OHLC bars; one row per (Symbol, Timeframe, BarStart)
        b.Entity<HistoricalBar>(e =>
        {
            e.HasIndex(x => new { x.Symbol, x.Timeframe, x.BarStart }).IsUnique();
            e.Property(x => x.Timeframe).HasConversion<string>();
            e.Property(x => x.Open).HasPrecision(18, 4);
            e.Property(x => x.High).HasPrecision(18, 4);
            e.Property(x => x.Low).HasPrecision(18, 4);
            e.Property(x => x.Close).HasPrecision(18, 4);
            e.Property(x => x.VWAP).HasPrecision(18, 4);
        });

        b.Entity<OrderJournalEntry>(e =>
        {
            e.HasIndex(x => x.ClientOrderId).IsUnique();
            e.HasIndex(x => new { x.Underlying, x.UpdatedAt });
            e.HasIndex(x => x.AlpacaOrderId);
            e.Property(x => x.ClientOrderId).HasMaxLength(128);
            e.Property(x => x.AlpacaOrderId).HasMaxLength(128);
            e.Property(x => x.Underlying).HasMaxLength(16);
            e.Property(x => x.Symbol).HasMaxLength(64);
            e.Property(x => x.Side).HasMaxLength(8);
            e.Property(x => x.Qty).HasMaxLength(32);
            e.Property(x => x.FilledQty).HasMaxLength(32);
            e.Property(x => x.LimitPrice).HasMaxLength(32);
            e.Property(x => x.DeskState).HasMaxLength(32);
            e.Property(x => x.BrokerStatus).HasMaxLength(32);
            e.Property(x => x.Source).HasMaxLength(16);
            e.Property(x => x.LastError).HasMaxLength(500);
        });

        b.Entity<TradeOutcome>(e =>
        {
            e.HasIndex(x => x.ClientOrderId).IsUnique();
            e.HasIndex(x => new { x.Underlying, x.UpdatedAt });
            e.HasIndex(x => x.WheelCycleId);
            e.HasIndex(x => x.OutcomeLabel);
            e.HasIndex(x => x.CohortKey);
            e.Property(x => x.ClientOrderId).HasMaxLength(128);
            e.Property(x => x.AlpacaOrderId).HasMaxLength(128);
            e.Property(x => x.WheelCycleId).HasMaxLength(64);
            e.Property(x => x.Underlying).HasMaxLength(16);
            e.Property(x => x.Symbol).HasMaxLength(64);
            e.Property(x => x.Side).HasMaxLength(8);
            e.Property(x => x.OptionRight).HasMaxLength(8);
            e.Property(x => x.WheelSide).HasMaxLength(8);
            e.Property(x => x.Qty).HasMaxLength(32);
            e.Property(x => x.FilledQty).HasMaxLength(32);
            e.Property(x => x.LimitPrice).HasMaxLength(32);
            e.Property(x => x.FilledAvgPrice).HasMaxLength(32);
            e.Property(x => x.PremiumCash).HasPrecision(18, 4);
            e.Property(x => x.Fees).HasPrecision(18, 4);
            e.Property(x => x.RealizedPnL).HasPrecision(18, 4);
            e.Property(x => x.OutcomeLabel).HasMaxLength(32);
            e.Property(x => x.Source).HasMaxLength(16);
            e.Property(x => x.Level).HasMaxLength(16);
            e.Property(x => x.HmmRegime).HasMaxLength(16);
            e.Property(x => x.Granularity).HasMaxLength(16);
            e.Property(x => x.CohortKey).HasMaxLength(128);
            e.Property(x => x.AnomalyReason).HasMaxLength(500);
            e.Property(x => x.ModelStrike).HasPrecision(18, 4);
            e.Property(x => x.SnappedStrike).HasPrecision(18, 4);
            e.Property(x => x.SpotAtSubmit).HasPrecision(18, 4);
            e.Property(x => x.SuggestedLimit).HasPrecision(18, 4);
            e.Property(x => x.MidAtSubmit).HasPrecision(18, 4);
            e.Property(x => x.BidAtSubmit).HasPrecision(18, 4);
        });
    }
}
