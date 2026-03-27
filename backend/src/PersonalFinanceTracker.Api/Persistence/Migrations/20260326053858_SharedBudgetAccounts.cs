using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalFinanceTracker.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SharedBudgetAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_budgets_UserId_CategoryId_Month_Year",
                schema: "public",
                table: "budgets");

            migrationBuilder.AddColumn<Guid>(
                name: "AccountId",
                schema: "public",
                table: "budgets",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_recurring_transactions_AccountId",
                schema: "public",
                table: "recurring_transactions",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_recurring_transactions_CategoryId",
                schema: "public",
                table: "recurring_transactions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_budgets_AccountId",
                schema: "public",
                table: "budgets",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_budgets_UserId_CategoryId_Month_Year_AccountId",
                schema: "public",
                table: "budgets",
                columns: new[] { "UserId", "CategoryId", "Month", "Year", "AccountId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_budgets_accounts_AccountId",
                schema: "public",
                table: "budgets",
                column: "AccountId",
                principalSchema: "public",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_recurring_transactions_accounts_AccountId",
                schema: "public",
                table: "recurring_transactions",
                column: "AccountId",
                principalSchema: "public",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_recurring_transactions_categories_CategoryId",
                schema: "public",
                table: "recurring_transactions",
                column: "CategoryId",
                principalSchema: "public",
                principalTable: "categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_budgets_accounts_AccountId",
                schema: "public",
                table: "budgets");

            migrationBuilder.DropForeignKey(
                name: "FK_recurring_transactions_accounts_AccountId",
                schema: "public",
                table: "recurring_transactions");

            migrationBuilder.DropForeignKey(
                name: "FK_recurring_transactions_categories_CategoryId",
                schema: "public",
                table: "recurring_transactions");

            migrationBuilder.DropIndex(
                name: "IX_recurring_transactions_AccountId",
                schema: "public",
                table: "recurring_transactions");

            migrationBuilder.DropIndex(
                name: "IX_recurring_transactions_CategoryId",
                schema: "public",
                table: "recurring_transactions");

            migrationBuilder.DropIndex(
                name: "IX_budgets_AccountId",
                schema: "public",
                table: "budgets");

            migrationBuilder.DropIndex(
                name: "IX_budgets_UserId_CategoryId_Month_Year_AccountId",
                schema: "public",
                table: "budgets");

            migrationBuilder.DropColumn(
                name: "AccountId",
                schema: "public",
                table: "budgets");

            migrationBuilder.CreateIndex(
                name: "IX_budgets_UserId_CategoryId_Month_Year",
                schema: "public",
                table: "budgets",
                columns: new[] { "UserId", "CategoryId", "Month", "Year" },
                unique: true);
        }
    }
}
