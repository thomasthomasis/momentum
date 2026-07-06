using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Momentum.Api.Migrations
{
    /// <inheritdoc />
    public partial class SecurityHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_tags_name",
                table: "tags");

            migrationBuilder.RenameColumn(
                name: "token",
                table: "refresh_tokens",
                newName: "token_hash");

            migrationBuilder.RenameIndex(
                name: "ix_refresh_tokens_token",
                table: "refresh_tokens",
                newName: "ix_refresh_tokens_token_hash");

            // CAUTION if this migration is ever run against a database that
            // already has real tag data: this backfills every existing tag's
            // UserId to "" (no real user), which:
            //   (a) orphans those tags — GetAll/Rename/Delete all filter by
            //       UserId == the real signed-in user, so they'd become
            //       permanently invisible to whoever created them, and
            //   (b) since old tags were shared by name across users, a tag
            //       used by multiple users would need to become multiple
            //       per-user rows, not one row reassigned to one user — there
            //       is no backfill value that's correct for a shared row.
            // Deliberately not attempting that data migration here since this
            // is being applied to a database with no production data yet. If
            // you ever need to run this against populated data, write a
            // proper backfill first: for each distinct (tag, user) pair
            // derived from focus_session_tags -> focus_sessions.user_id,
            // create a separate per-user tag row and repoint that user's
            // focus_session_tags rows to it.
            migrationBuilder.AddColumn<string>(
                name: "user_id",
                table: "tags",
                type: "text",
                nullable: false,
                defaultValue: "");

            // Deliberately NOT adding "xmin" here — it's a Postgres system column
            // that already exists on every table. EF's migration scaffolder
            // doesn't know that and generates an AddColumn for it regardless of
            // mapping API (UseXminAsConcurrencyToken vs. Property/IsRowVersion
            // produce the same bogus output); running that would fail with
            // "column xmin already exists". The model mapping in AppDbContext is
            // still correct and needs no corresponding migration for this column.

            migrationBuilder.CreateIndex(
                name: "ix_tags_user_id_name",
                table: "tags",
                columns: new[] { "user_id", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_tags_user_id_name",
                table: "tags");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "tags");

            migrationBuilder.RenameColumn(
                name: "token_hash",
                table: "refresh_tokens",
                newName: "token");

            migrationBuilder.RenameIndex(
                name: "ix_refresh_tokens_token_hash",
                table: "refresh_tokens",
                newName: "ix_refresh_tokens_token");

            migrationBuilder.CreateIndex(
                name: "ix_tags_name",
                table: "tags",
                column: "name",
                unique: true);
        }
    }
}
