-- BrandVault DDL PREVIEW — generated from prisma/schema.prisma via
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- This is a human-reviewable snapshot of the target MySQL 8.0 schema. It is
-- NOT the tracked migration. The real migration is created with
-- `npm run db:migrate` (prisma migrate dev) once DATABASE_URL points at a
-- reachable Azure MySQL instance. Regenerate this preview if the schema changes.

-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `clerk_org_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `companies_slug_key`(`slug`),
    UNIQUE INDEX `companies_clerk_org_id_key`(`clerk_org_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` ENUM('admin', 'editor', 'viewer') NOT NULL DEFAULT 'viewer',
    `company_id` VARCHAR(191) NOT NULL,
    `clerk_user_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_clerk_user_id_key`(`clerk_user_id`),
    INDEX `users_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_admins` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `platform_admins_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trademark_families` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `family_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trademark_families_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trademarks` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `family_id` VARCHAR(191) NULL,
    `registry_name` VARCHAR(191) NOT NULL,
    `mark_text` VARCHAR(191) NOT NULL,
    `status` ENUM('Registered', 'Pending', 'Published', 'Expired', 'Abandoned') NOT NULL,
    `application_number` VARCHAR(191) NULL,
    `registration_number` VARCHAR(191) NULL,
    `filing_date` DATETIME(3) NULL,
    `registration_date` DATETIME(3) NULL,
    `expiry_date` DATETIME(3) NULL,
    `publication_date` DATETIME(3) NULL,
    `client_agent_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trademarks_company_id_idx`(`company_id`),
    INDEX `trademarks_family_id_idx`(`family_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goods_and_services` (
    `id` VARCHAR(191) NOT NULL,
    `trademark_id` VARCHAR(191) NOT NULL,
    `class_number` INTEGER NOT NULL,
    `text` TEXT NOT NULL,

    INDEX `goods_and_services_trademark_id_idx`(`trademark_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notes` (
    `id` VARCHAR(191) NOT NULL,
    `trademark_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `html` TEXT NULL,
    `link` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notes_trademark_id_idx`(`trademark_id`),
    INDEX `notes_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deadlines` (
    `id` VARCHAR(191) NOT NULL,
    `trademark_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `due_date` DATETIME(3) NOT NULL,
    `window_start` DATETIME(3) NOT NULL,
    `alert_180_sent` BOOLEAN NOT NULL DEFAULT false,
    `alert_90_sent` BOOLEAN NOT NULL DEFAULT false,
    `alert_30_sent` BOOLEAN NOT NULL DEFAULT false,

    INDEX `deadlines_due_date_idx`(`due_date`),
    UNIQUE INDEX `deadlines_trademark_id_type_due_date_key`(`trademark_id`, `type`, `due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `is_platform_admin` BOOLEAN NOT NULL DEFAULT false,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `detail_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_company_id_idx`(`company_id`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `slack_channel_id` VARCHAR(191) NULL,
    `slack_enabled` BOOLEAN NOT NULL DEFAULT false,
    `email_enabled` BOOLEAN NOT NULL DEFAULT true,
    `threshold_days` JSON NOT NULL,

    UNIQUE INDEX `alert_preferences_company_id_key`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_admins` ADD CONSTRAINT `platform_admins_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trademark_families` ADD CONSTRAINT `trademark_families_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trademarks` ADD CONSTRAINT `trademarks_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trademarks` ADD CONSTRAINT `trademarks_family_id_fkey` FOREIGN KEY (`family_id`) REFERENCES `trademark_families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_and_services` ADD CONSTRAINT `goods_and_services_trademark_id_fkey` FOREIGN KEY (`trademark_id`) REFERENCES `trademarks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_trademark_id_fkey` FOREIGN KEY (`trademark_id`) REFERENCES `trademarks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deadlines` ADD CONSTRAINT `deadlines_trademark_id_fkey` FOREIGN KEY (`trademark_id`) REFERENCES `trademarks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_preferences` ADD CONSTRAINT `alert_preferences_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

