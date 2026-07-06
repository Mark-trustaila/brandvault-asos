-- AlterTable
ALTER TABLE `companies` ADD COLUMN `inbound_email_slug` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `inbound_emails` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `from_address` VARCHAR(191) NOT NULL,
    `subject` TEXT NOT NULL,
    `body_text` TEXT NOT NULL,
    `raw_headers_json` JSON NULL,
    `message_id` VARCHAR(191) NULL,
    `content_hash` VARCHAR(191) NOT NULL,
    `classification_json` JSON NULL,
    `matched_trademark_id` VARCHAR(191) NULL,
    `status` ENUM('pending', 'processed', 'needs_review', 'unmatched', 'dismissed') NOT NULL DEFAULT 'pending',
    `processed_at` DATETIME(3) NULL,
    `reviewed_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inbound_emails_company_id_idx`(`company_id`),
    INDEX `inbound_emails_status_idx`(`status`),
    UNIQUE INDEX `inbound_emails_company_id_content_hash_key`(`company_id`, `content_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `inbound_email_id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `storage_ref` VARCHAR(191) NULL,
    `extracted_text` TEXT NULL,

    INDEX `email_attachments_inbound_email_id_idx`(`inbound_email_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `companies_inbound_email_slug_key` ON `companies`(`inbound_email_slug`);

-- AddForeignKey
ALTER TABLE `inbound_emails` ADD CONSTRAINT `inbound_emails_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbound_emails` ADD CONSTRAINT `inbound_emails_matched_trademark_id_fkey` FOREIGN KEY (`matched_trademark_id`) REFERENCES `trademarks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_attachments` ADD CONSTRAINT `email_attachments_inbound_email_id_fkey` FOREIGN KEY (`inbound_email_id`) REFERENCES `inbound_emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

