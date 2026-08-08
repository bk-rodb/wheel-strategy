using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WheelStrategy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class TradeOutcomes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TradeOutcomes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ClientOrderId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    AlpacaOrderId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    WheelCycleId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Underlying = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Symbol = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Side = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    OptionRight = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    WheelSide = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Qty = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    FilledQty = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    LimitPrice = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    FilledAvgPrice = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    PremiumCash = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    Fees = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    RealizedPnL = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    OutcomeLabel = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Source = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    DecisionSnapshotJson = table.Column<string>(type: "TEXT", nullable: true),
                    Level = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    ModelStrike = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    SnappedStrike = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    TargetDelta = table.Column<double>(type: "REAL", nullable: true),
                    HmmRegime = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    SpotAtSubmit = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    SuggestedLimit = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    MidAtSubmit = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    BidAtSubmit = table.Column<decimal>(type: "TEXT", precision: 18, scale: 4, nullable: true),
                    Dte = table.Column<int>(type: "INTEGER", nullable: true),
                    Granularity = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    EarningsInWindow = table.Column<bool>(type: "INTEGER", nullable: true),
                    EmpiricalAssignmentProb = table.Column<double>(type: "REAL", nullable: true),
                    EstPremium = table.Column<double>(type: "REAL", nullable: true),
                    CohortKey = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    IsAnomaly = table.Column<bool>(type: "INTEGER", nullable: false),
                    AnomalyReason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    FilledAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TradeOutcomes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TradeOutcomes_ClientOrderId",
                table: "TradeOutcomes",
                column: "ClientOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TradeOutcomes_CohortKey",
                table: "TradeOutcomes",
                column: "CohortKey");

            migrationBuilder.CreateIndex(
                name: "IX_TradeOutcomes_OutcomeLabel",
                table: "TradeOutcomes",
                column: "OutcomeLabel");

            migrationBuilder.CreateIndex(
                name: "IX_TradeOutcomes_Underlying_UpdatedAt",
                table: "TradeOutcomes",
                columns: new[] { "Underlying", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TradeOutcomes_WheelCycleId",
                table: "TradeOutcomes",
                column: "WheelCycleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TradeOutcomes");
        }
    }
}
