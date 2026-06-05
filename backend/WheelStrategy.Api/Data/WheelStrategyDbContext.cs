using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Models;

namespace WheelStrategy.Api.Data;

public class WheelStrategyDbContext(DbContextOptions<WheelStrategyDbContext> options)
    : DbContext(options)
{
    public DbSet<BrokerAccount> BrokerAccounts => Set<BrokerAccount>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<OptionLeg> OptionLegs => Set<OptionLeg>();
    public DbSet<WatchlistItem> WatchlistItems => Set<WatchlistItem>();
    public DbSet<PriceSnapshot> PriceSnapshots => Set<PriceSnapshot>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // BrokerAccount
        b.Entity<BrokerAccount>(e =>
        {
            e.HasIndex(x => x.AccountNumber).IsUnique();
            e.Property(x => x.BrokerType).HasConversion<string>();
        });

        // Position
        b.Entity<Position>(e =>
        {
            e.HasIndex(x => new { x.BrokerAccountId, x.Symbol });
            e.Property(x => x.Phase).HasConversion<string>();
            e.Property(x => x.CostBasis).HasPrecision(18, 4);
            e.Property(x => x.CashDeployed).HasPrecision(18, 2);
            e.Property(x => x.PremiumCollectedTotal).HasPrecision(18, 2);
            e.Property(x => x.UnrealizedPnL).HasPrecision(18, 2);
            e.HasOne(x => x.BrokerAccount)
             .WithMany(x => x.Positions)
             .HasForeignKey(x => x.BrokerAccountId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // OptionLeg
        b.Entity<OptionLeg>(e =>
        {
            e.HasIndex(x => new { x.PositionId, x.Status });
            e.Property(x => x.OptionType).HasConversion<string>();
            e.Property(x => x.Status).HasConversion<string>();
            e.Property(x => x.Strike).HasPrecision(18, 2);
            e.Property(x => x.PremiumReceived).HasPrecision(18, 4);
            e.Property(x => x.ClosePrice).HasPrecision(18, 4);
            e.Property(x => x.RealizedPnL).HasPrecision(18, 2);
            e.HasOne(x => x.Position)
             .WithMany(x => x.OptionLegs)
             .HasForeignKey(x => x.PositionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // WatchlistItem
        b.Entity<WatchlistItem>(e =>
        {
            e.HasIndex(x => x.Symbol).IsUnique();
            e.HasIndex(x => x.DisplayOrder);
        });

        // PriceSnapshot — one row per symbol, upserted on sync
        b.Entity<PriceSnapshot>(e =>
        {
            e.HasIndex(x => x.Symbol).IsUnique();
            e.Property(x => x.CurrentPrice).HasPrecision(18, 4);
            e.Property(x => x.PreviousClose).HasPrecision(18, 4);
            e.Property(x => x.DayOpen).HasPrecision(18, 4);
            e.Property(x => x.DayHigh).HasPrecision(18, 4);
            e.Property(x => x.DayLow).HasPrecision(18, 4);
        });
    }
}
