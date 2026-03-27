using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalFinanceTracker.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CashKaleshFeatureCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_account_members_AccountId",
                schema: "public",
                table: "account_members");

            migrationBuilder.AddColumn<bool>(
                name: "EmailSent",
                schema: "public",
                table: "notifications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "password_reset_tokens",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_password_reset_tokens_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_account_members_AccountId_UserId",
                schema: "public",
                table: "account_members",
                columns: new[] { "AccountId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_account_invitations_AccountId",
                schema: "public",
                table: "account_invitations",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_account_invitations_InviteToken",
                schema: "public",
                table: "account_invitations",
                column: "InviteToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_password_reset_tokens_TokenHash",
                schema: "public",
                table: "password_reset_tokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_password_reset_tokens_UserId",
                schema: "public",
                table: "password_reset_tokens",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_account_invitations_accounts_AccountId",
                schema: "public",
                table: "account_invitations",
                column: "AccountId",
                principalSchema: "public",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_account_invitations_accounts_AccountId",
                schema: "public",
                table: "account_invitations");

            migrationBuilder.DropTable(
                name: "password_reset_tokens",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_account_members_AccountId_UserId",
                schema: "public",
                table: "account_members");

            migrationBuilder.DropIndex(
                name: "IX_account_invitations_AccountId",
                schema: "public",
                table: "account_invitations");

            migrationBuilder.DropIndex(
                name: "IX_account_invitations_InviteToken",
                schema: "public",
                table: "account_invitations");

            migrationBuilder.DropColumn(
                name: "EmailSent",
                schema: "public",
                table: "notifications");

            migrationBuilder.CreateIndex(
                name: "IX_account_members_AccountId",
                schema: "public",
                table: "account_members",
                column: "AccountId");
        }
    }
}
