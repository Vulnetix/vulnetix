PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ALTER TABLE IntegrationUsageLog RENAME TO IntegrationUsageLog2;
-- CREATE TABLE "IntegrationUsageLog" (
--     "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
--     "orgId" TEXT NOT NULL,
--     "source" TEXT NOT NULL,
--     "memberUuid" TEXT NOT NULL,
--     "memberEmail" TEXT NOT NULL,
--     "request" TEXT NOT NULL,
--     "response" TEXT,
--     "statusCode" INTEGER NOT NULL,
--     "createdAt" INTEGER NOT NULL
-- );
-- INSERT INTO "IntegrationUsageLog" ("memberUuid", "memberEmail", "createdAt", "id", "orgId", "request", "response", "source", "statusCode") SELECT "" AS "memberUuid", "memberEmail", "createdAt", "id", "orgId", "request", "response", "source", "statusCode" FROM "IntegrationUsageLog2";

-- UPDATE IntegrationUsageLog
-- SET
--   memberUuid = (
--     SELECT
--       m.uuid
--     FROM
--       Member m
--     WHERE
--       m.orgId = IntegrationUsageLog.orgId
--       AND m.email = IntegrationUsageLog.memberEmail
--     LIMIT
--       1
--   );
-- ALTER TABLE IntegrationUsageLog DROP COLUMN memberEmail;

-- ALTER TABLE MemberKey RENAME TO MemberKey2;
-- CREATE TABLE "MemberKey" (
--     "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
--     "keyLabel" TEXT,
--     "keyType" TEXT NOT NULL,
--     "memberUuid" TEXT NOT NULL,
--     "memberEmail" TEXT NOT NULL,
--     "secret" TEXT NOT NULL,
--     "suspend" INTEGER NOT NULL DEFAULT 0
-- );
-- INSERT INTO "MemberKey" ("memberUuid", "memberEmail", "id", "keyLabel", "keyType", "secret", "suspend") SELECT "" AS "memberUuid", "memberEmail", "id", "keyLabel", "keyType", "secret", "suspend" FROM "MemberKey2";
-- UPDATE MemberKey
-- SET
--   memberUuid = (
--     SELECT
--       m.uuid
--     FROM
--       Member m
--     WHERE
--       m.email = MemberKey.memberEmail
--     LIMIT
--       1
--   );
-- ALTER TABLE MemberKey DROP COLUMN memberEmail;
-- CREATE UNIQUE INDEX "MemberKey_memberUuid_secret_key" ON "MemberKey"("memberUuid", "secret");

-- ALTER TABLE `Session` RENAME TO Session2;
-- CREATE TABLE "Session" (
--     "kid" TEXT NOT NULL PRIMARY KEY,
--     "orgId" TEXT NOT NULL,
--     "memberUuid" TEXT NOT NULL,
--     "memberEmail" TEXT NOT NULL,
--     "expiry" INTEGER NOT NULL,
--     "issued" INTEGER NOT NULL,
--     "secret" TEXT,
--     "authn_ip" TEXT,
--     "authn_ua" TEXT
-- );
-- INSERT INTO "Session" ("memberUuid", "memberEmail", "authn_ip", "authn_ua", "expiry", "issued", "kid", "orgId", "secret") SELECT "" AS "memberUuid", "memberEmail", "authn_ip", "authn_ua", "expiry", "issued", "kid", "orgId", "secret" FROM "Session2";
-- UPDATE `Session`
-- SET
--   memberUuid = (
--     SELECT
--       m.uuid
--     FROM
--       Member m
--     WHERE
--       m.orgId = `Session`.orgId
--       AND m.email = `Session`.memberEmail
--     LIMIT
--       1
--   );
-- ALTER TABLE `Session` DROP COLUMN memberEmail;

ALTER TABLE Triage RENAME TO Triage2;
CREATE TABLE "Triage" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "artifactUuid" TEXT,
    "findingUuid" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "triagedAt" INTEGER,
    "lastObserved" INTEGER NOT NULL,
    "seen" INTEGER NOT NULL,
    "seenAt" INTEGER,
    "cvssVector" TEXT,
    "cvssScore" TEXT,
    "epssPercentile" TEXT,
    "epssScore" TEXT,
    "ssvc" TEXT,
    "remediation" TEXT,
    "analysisState" TEXT NOT NULL,
    "analysisJustification" TEXT,
    "analysisResponse" TEXT,
    "analysisDetail" TEXT,
    "triageAutomated" INTEGER NOT NULL DEFAULT 0,
    "memberUuid" TEXT,
    "memberEmail" TEXT
);
INSERT INTO "Triage" ("memberUuid", "memberEmail", "analysisDetail", "analysisJustification", "analysisResponse", "analysisState", "artifactUuid", "createdAt", "cvssScore", "cvssVector", "epssPercentile", "epssScore", "findingUuid", "lastObserved", "remediation", "seen", "seenAt", "ssvc", "triageAutomated", "triagedAt", "uuid") SELECT "memberUuid", "memberEmail", "analysisDetail", "analysisJustification", "analysisResponse", "analysisState", "artifactUuid", "createdAt", "cvssScore", "cvssVector", "epssPercentile", "epssScore", "findingUuid", "lastObserved", "remediation", "seen", "seenAt", "ssvc", "triageAutomated", "triagedAt", "uuid" FROM "Triage2";
UPDATE Triage
SET
  memberUuid = (
    SELECT
      m.uuid
    FROM
      Member m
    WHERE
      m.email = Triage.memberEmail
    LIMIT
      1
  );
ALTER TABLE Triage DROP COLUMN memberEmail;
CREATE UNIQUE INDEX "Triage_findingUuid_analysisState_key" ON "Triage"("findingUuid", "analysisState");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
