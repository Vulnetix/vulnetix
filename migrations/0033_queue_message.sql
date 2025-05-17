CREATE TABLE IF NOT EXISTS `QueueMessage` (
    `messageId` TEXT PRIMARY KEY NOT NULL,
    `status` TEXT NOT NULL,
    `uniqueId` TEXT NOT NULL,
    `linkId` TEXT NOT NULL,
    `type` TEXT NOT NULL,
    `orgId` TEXT NOT NULL,
    `createdAt` INTEGER NOT NULL
);
