using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WheelStrategy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HistoricalBars",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Symbol = table.Column<string>(type: "TEXT", nullable: false),
                    Timeframe = table.Column<string>(type: "TEXT", nullable: false),
                    BarStart = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    Open = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    High = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    Low = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    Close = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    Volume = table.Column<long>(type: "INTEGER", nullable: false),
                    TradeCount = table.Column<long>(type: "INTEGER", nullable: false),
                    VWAP = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: false),
                    Adjustment = table.Column<string>(type: "TEXT", nullable: false),
                    FetchedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistoricalBars", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalBars_Symbol_Timeframe_BarStart",
                table: "HistoricalBars",
                columns: new[] { "Symbol", "Timeframe", "BarStart" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HistoricalBars");
        }
    }
}
