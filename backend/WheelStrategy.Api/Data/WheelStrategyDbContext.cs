using Microsoft.EntityFrameworkCore;
using WheelStrategy.Api.Models;

namespace WheelStrategy.Api.Data;

public class WheelStrategyDbContext(DbContextOptions<WheelStrategyDbContext> options)
    : DbContext(options)
{
    public DbSet<HistoricalBar> HistoricalBars => Set<HistoricalBar>();

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
    }
}
