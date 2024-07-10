DROP TABLE IF EXISTS "findings_sca";
CREATE TABLE "findings" (
    "findingId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "modifiedAt" INTEGER NOT NULL,
    "publishedAt" INTEGER,
    "detectionTitle" TEXT NOT NULL,
    "purl" TEXT,
    "cpe" TEXT,
    "databaseReviewed" INTEGER,
    "cve" TEXT,
    "aliases" TEXT,
    "cwes" TEXT,
    "packageName" TEXT NOT NULL,
    "packageVersion" TEXT,
    "vendor" TEXT,
    "product" TEXT,
    "packageEcosystem" TEXT,
    "sourceCodeUrl" TEXT,
    "exploitsJSON" TEXT,
    "knownExploitsJSON" TEXT,
    "cisaDateAdded" INTEGER,
    "knownRansomwareCampaignUse" TEXT,
    "fixVersion" TEXT,
    "fixAutomatable" INTEGER,
    "vulnerableVersionRange" TEXT,
    "licenseDeclared" TEXT,
    "maliciousSource" TEXT,
    "abandoned" INTEGER,
    "squattedPackage" TEXT,
    "referencesJSON" TEXT,
    "spdxId" TEXT,
    "cdxId" TEXT
);
CREATE UNIQUE INDEX "findings_key" ON "findings"("findingId");
CREATE TABLE "triage_activity" (
    "findingId" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "seen" INTEGER NOT NULL,
    "seenAt" INTEGER,
    "cvssVector" TEXT,
    "cvssScore" TEXT,
    "epssPercentile" TEXT,
    "epssScore" TEXT,
    "ssvc" TEXT,
    "remediation" TEXT,
    "analysisState" TEXT NOT NULL,
    -- resolved
    -- resolved_with_pedigree
    -- exploitable
    -- in_triage
    -- false_positive
    -- not_affected
    "analysisJustification" TEXT,
    -- code_not_present
    -- code_not_reachable
    -- requires_configuration
    -- requires_dependency
    -- requires_environment
    -- protected_by_compiler
    -- protected_at_runtime
    -- protected_at_perimeter
    -- protected_by_mitigating_control
    "analysisResponseJSON" TEXT,
    -- can_not_fix
    -- will_not_fix
    -- update
    -- rollback
    -- workaround_available
    "analysisDetail" TEXT
);
CREATE UNIQUE INDEX "triage_activity_key" ON "triage_activity"("findingId", "analysisState");
