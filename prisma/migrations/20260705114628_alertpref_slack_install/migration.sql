-- AlterTable
ALTER TABLE `alert_preferences` ADD COLUMN `slack_bot_token` VARCHAR(191) NULL,
    ADD COLUMN `slack_team_id` VARCHAR(191) NULL,
    ADD COLUMN `slack_team_name` VARCHAR(191) NULL;
