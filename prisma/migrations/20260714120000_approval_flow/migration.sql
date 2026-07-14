-- Add awaiting_approval to the inbound email status enum.
ALTER TABLE `inbound_emails`
  MODIFY `status` ENUM('pending', 'processed', 'needs_review', 'unmatched', 'dismissed', 'awaiting_approval') NOT NULL DEFAULT 'pending';

-- CreateTable: propose-and-approve records for Bree's mark-mutating inbound actions.
CREATE TABLE `approvals` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `inbound_email_id` VARCHAR(191) NULL,
    `trademark_id` VARCHAR(191) NULL,
    `action_type` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `payload_json` JSON NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `proposed_by` VARCHAR(191) NOT NULL DEFAULT 'Bree',
    `decided_by_slack_id` VARCHAR(191) NULL,
    `decided_by_slack_name` VARCHAR(191) NULL,
    `decided_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `approvals_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_inbound_email_id_fkey` FOREIGN KEY (`inbound_email_id`) REFERENCES `inbound_emails`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_trademark_id_fkey` FOREIGN KEY (`trademark_id`) REFERENCES `trademarks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
