DROP TABLE IF EXISTS "integration_usage_log";
CREATE TABLE "integration_usage_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "response" TEXT,
    "statusCode" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "integration_usage_log_key" ON "integration_usage_log"("id");
