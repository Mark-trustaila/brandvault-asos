-- CreateTable
CREATE TABLE `bree_query_logs` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `input_text` TEXT NOT NULL,
    `resolved_intent` VARCHAR(191) NOT NULL,
    `matched_trademark_id` VARCHAR(191) NULL,
    `latency_ms` INTEGER NOT NULL,
    `fallback` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bree_query_logs_company_id_created_at_idx`(`company_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bree_query_logs` ADD CONSTRAINT `bree_query_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bree_query_logs` ADD CONSTRAINT `bree_query_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bree_query_logs` ADD CONSTRAINT `bree_query_logs_matched_trademark_id_fkey` FOREIGN KEY (`matched_trademark_id`) REFERENCES `trademarks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
