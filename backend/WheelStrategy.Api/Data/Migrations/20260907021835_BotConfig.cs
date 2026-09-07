using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WheelStrategy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BotConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BotLastCycles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Symbol = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    TargetFriday = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    ClientOrderId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    At = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    RetryIndex = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BotLastCycles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BotRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    At = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Symbol = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    TargetFriday = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Side = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Qty = table.Column<int>(type: "INTEGER", nullable: false),
                    DryRun = table.Column<bool>(type: "INTEGER", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Reason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    ContractSymbol = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Strike = table.Column<double>(type: "REAL", nullable: true),
                    SellLimit = table.Column<double>(type: "REAL", nullable: true),
                    OrderId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    ClientOrderId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    BlockersJson = table.Column<string>(type: "TEXT", nullable: true),
                    WarningsJson = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BotRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BotSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SymbolsJson = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Level = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    DryRun = table.Column<bool>(type: "INTEGER", nullable: false),
                    Paused = table.Column<bool>(type: "INTEGER", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BotSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BotLastCycles_Symbol",
                table: "BotLastCycles",
                column: "Symbol",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BotRuns_Symbol_At",
                table: "BotRuns",
                columns: new[] { "Symbol", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_BotRuns_TargetFriday_Status",
                table: "BotRuns",
                columns: new[] { "TargetFriday", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BotLastCycles");

            migrationBuilder.DropTable(
                name: "BotRuns");

            migrationBuilder.DropTable(
                name: "BotSettings");
        }
    }
}
