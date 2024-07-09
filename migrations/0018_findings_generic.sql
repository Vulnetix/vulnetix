DROP TABLE IF EXISTS "findings_sca";
CREATE TABLE "findings" (
    "findingId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "modifiedAt" INTEGER NOT NULL,
    "detectionTitle" TEXT NOT NULL,
    "purl" TEXT,
    "cpe" TEXT,
    "packageName" TEXT NOT NULL,
    "packageVersion" TEXT,
    "spdxId" TEXT,
    "cdxId" TEXT
);
CREATE UNIQUE INDEX "findings_key" ON "findings"("findingId");

CREATE TABLE "triage_activity" (
    "findingId" INTEGER NOT NULL,
    "status" TEXT,
    "discoveredAt" INTEGER,
    "cvss" TEXT,
    "epss" TEXT,
    "ssvc" TEXT,
    "vendor" TEXT,
    "product" TEXT,
    "exploitsJSON" TEXT,
    "knownExploitsJSON" TEXT,
    "cisaDateAdded" INTEGER,
    "knownRansomwareCampaignUse" TEXT,
    "fixVersion" TEXT,
    "remediation" TEXT,
    "maliciousSource" TEXT,
    "abandoned" INTEGER,
    "squattedPackage" TEXT
);
CREATE UNIQUE INDEX "triage_meta_key" ON "triage_meta"("findingId");
