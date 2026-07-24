# Pending migrations — staged, deliberately not applied

Migrations in this directory are **prepared for review and cannot be applied by
accident**. `prisma migrate deploy` only reads `prisma/migrations/`, so nothing
here runs until it is explicitly promoted.

Why the separate directory rather than the normal one: Preview and Production
currently point at the **same Azure MySQL database** (see the root `CLAUDE.md`
env table). A migration sitting in `prisma/migrations/` is one stray
`npm run db:deploy` away from altering production. Staging it here removes that
path entirely.

---

## 20260724_trademark_registry_status_raw

Adds `trademarks.registry_status_raw VARCHAR(191) NULL`.

Holds the registry's verbatim status string next to the mapped `MarkStatus`
enum value, so the conservative mapping stays lossless in practice — you can
always recover what the register actually said. Chosen over widening the enum,
which would be a destructive-by-comparison change to a live column and is not
something to do before a demo recording.

### Why `prisma/schema.prisma` is NOT changed yet

Adding the field to the Prisma model without applying the migration **breaks the
running app**. Prisma Client generates an explicit column list for every query,
so a bare `prisma.trademark.findMany()` would select `registry_status_raw`, hit
`Unknown column`, and error — on any deployment built from this branch. Because
Preview and Production share one database, a preview build of this branch would
be querying the production database with a schema that does not match it.

So the model edit is staged here as a patch and applied only once the column
exists.

### Promotion sequence (all steps need explicit approval)

1. Apply the DDL to the target database (`migration.sql` above).
2. Apply the model patch below to `prisma/schema.prisma`.
3. `npx prisma generate`.
4. Move this directory into `prisma/migrations/` so migration history stays
   truthful, or record it as an out-of-band change — whichever you prefer.

Steps 1 and 2 must not be separated by a deploy.

### Model patch for step 2

In `model Trademark`, alongside the other optional fields:

```prisma
  // Verbatim status string as the source registry expressed it (e.g. "Dead",
  // "Removed", "Registered past expiry"). The `status` enum above holds the
  // conservative mapping; this keeps the original so the mapping is auditable
  // and reversible without a data migration.
  registryStatusRaw String? @map("registry_status_raw")
```

### Rollback

```sql
ALTER TABLE `trademarks` DROP COLUMN `registry_status_raw`;
```

No data loss for anything that existed before the column was added.
