-- AlterTable
ALTER TABLE `inbound_emails` ADD COLUMN `review_classification_json` JSON NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL;

