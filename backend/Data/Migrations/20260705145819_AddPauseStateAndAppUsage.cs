using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Momentum.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPauseStateAndAppUsage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_paused",
                table: "focus_sessions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "paused_at",
                table: "focus_sessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "total_paused_seconds",
                table: "focus_sessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "app_usages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    focus_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    app_name = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    time_spent_seconds = table.Column<int>(type: "integer", nullable: false),
                    switch_count = table.Column<int>(type: "integer", nullable: false),
                    recorded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_app_usages", x => x.id);
                    table.ForeignKey(
                        name: "fk_app_usages_focus_sessions_focus_session_id",
                        column: x => x.focus_session_id,
                        principalTable: "focus_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_app_usages_focus_session_id",
                table: "app_usages",
                column: "focus_session_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_usages");

            migrationBuilder.DropColumn(
                name: "is_paused",
                table: "focus_sessions");

            migrationBuilder.DropColumn(
                name: "paused_at",
                table: "focus_sessions");

            migrationBuilder.DropColumn(
                name: "total_paused_seconds",
                table: "focus_sessions");
        }
    }
}
