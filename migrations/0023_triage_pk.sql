DROP TABLE IF EXISTS "triage_activity";
DROP INDEX IF EXISTS "triage_activity_key";
CREATE TABLE "triage_activity" (
    "findingId" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
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
CREATE INDEX "triage_activity_key" ON "triage_activity"("findingId");
CREATE UNIQUE INDEX "triage_activity_unique" ON "triage_activity"("findingId", "analysisState");
