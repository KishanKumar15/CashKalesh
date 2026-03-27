using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalFinanceTracker.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserProfileDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "City",
                schema: "public",
                table: "users",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Headline",
                schema: "public",
                table: "users",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                schema: "public",
                table: "users",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProfileImageUrl",
                schema: "public",
                table: "users",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "City",
                schema: "public",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Headline",
                schema: "public",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                schema: "public",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ProfileImageUrl",
                schema: "public",
                table: "users");
        }
    }
}
