-- AlterTable
ALTER TABLE `trademarks` ADD COLUMN `owner_country` VARCHAR(191) NULL,
    ADD COLUMN `owner_name` VARCHAR(191) NULL,
    ADD COLUMN `representative_name` VARCHAR(191) NULL,
    ADD COLUMN `representative_reference` VARCHAR(191) NULL;
