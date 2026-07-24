-- PREPARED — NOT APPLIED. Awaiting review (see prisma/migrations-pending/README.md).
--
-- Additive, nullable, no backfill, no default, no index. Existing rows are
-- untouched and every existing query keeps working. The MarkStatus enum is NOT
-- modified — that is the whole point of this column: the registry's own status
-- vocabulary is wider than our five values (Dead, Removed, Opposed, …), and we
-- want the verbatim string retained alongside the conservative enum mapping
-- rather than expanding the enum before the demo.
--
-- Reversible with: ALTER TABLE `trademarks` DROP COLUMN `registry_status_raw`;

ALTER TABLE `trademarks`
    ADD COLUMN `registry_status_raw` VARCHAR(191) NULL;
