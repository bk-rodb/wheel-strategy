using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WheelStrategy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrderJournal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrderJournalEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ClientOrderId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    AlpacaOrderId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Underlying = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Symbol = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Side = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Qty = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    FilledQty = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    LimitPrice = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    DeskState = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    BrokerStatus = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    Source = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    LastError = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TerminalAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderJournalEntries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderJournalEntries_AlpacaOrderId",
                table: "OrderJournalEntries",
                column: "AlpacaOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderJournalEntries_ClientOrderId",
                table: "OrderJournalEntries",
                column: "ClientOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderJournalEntries_Underlying_UpdatedAt",
                table: "OrderJournalEntries",
                columns: new[] { "Underlying", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderJournalEntries");
        }
    }
}
