CREATE TABLE IF NOT EXISTS `QueueMessage` (
    `messageId` TEXT PRIMARY KEY NOT NULL,
    `status` TEXT NOT NULL,
    `uniqueId` TEXT,
    `linkId` TEXT,
    `type` TEXT NOT NULL,
    `displayText` TEXT NOT NULL,
    `orgId` TEXT NOT NULL,
    `createdAt` INTEGER NOT NULL
);
