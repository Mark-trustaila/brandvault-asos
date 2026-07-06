-- AlterTable
ALTER TABLE `audit_logs` ADD COLUMN `actor` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `deadlines` ADD COLUMN `completed_at` DATETIME(3) NULL;

