DROP INDEX "cdx_cdxId_key";
DROP INDEX "github_apps_installationId_key";
DROP INDEX "github_pat_keyId_key";
DROP INDEX "member_keys_memberEmail_secret_key";
DROP INDEX "members_email_key";
DROP INDEX "sarif_sarifId_key";
DROP INDEX "sarif_results_guid_key";
DROP INDEX "sessions_kid_key";
DROP INDEX "spdx_spdxId_key";
CREATE TABLE "Org" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);
INSERT INTO "Org" ("uuid", "name")
SELECT "uuid",
    "name"
FROM "orgs";
DROP TABLE "orgs";
CREATE TABLE "Member" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "alertNews" INTEGER NOT NULL DEFAULT 0,
    "alertOverdue" INTEGER NOT NULL DEFAULT 0,
    "alertFindings" INTEGER NOT NULL DEFAULT 0,
    "alertType" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "Member" (
        "uuid",
        "email",
        "orgId",
        "passwordHash",
        "avatarUrl",
        "firstName",
        "lastName",
        "alertNews",
        "alertOverdue",
        "alertFindings",
        "alertType"
    )
SELECT "uuid",
    "email",
    "orgId",
    "passwordHash",
    "avatarUrl",
    "firstName",
    "lastName",
    "alertNews",
    "alertOverdue",
    "alertFindings",
    "alertType"
FROM "members";
DROP TABLE "members";
CREATE TABLE "MemberKey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberEmail" TEXT NOT NULL,
    "keyLabel" TEXT,
    "keyType" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "suspend" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "MemberKey" (
        "id",
        "memberEmail",
        "keyLabel",
        "keyType",
        "secret",
        "suspend"
    )
SELECT "id",
    "memberEmail",
    "keyLabel",
    "keyType",
    "secret",
    "suspend"
FROM "member_keys";
DROP TABLE "member_keys";
CREATE TABLE "GitHubPAT" (
    "keyId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "expires" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "avatarUrl" TEXT
);
INSERT INTO "GitHubPAT" (
        "keyId",
        "login",
        "expires",
        "created",
        "avatarUrl"
    )
SELECT "keyId",
    "login",
    "expires",
    "created",
    "avatarUrl"
FROM "github_pat";
DROP TABLE "github_pat";
CREATE TABLE "GitHubApp" (
    "installationId" INTEGER NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "login" TEXT,
    "created" INTEGER NOT NULL,
    "expires" INTEGER,
    "avatarUrl" TEXT
);
INSERT INTO "GitHubApp" (
        "installationId",
        "memberEmail",
        "accessToken",
        "login",
        "created",
        "expires",
        "avatarUrl"
    )
SELECT "installationId",
    "memberEmail",
    "accessToken",
    "login",
    "created",
    "expires",
    "avatarUrl"
FROM "github_apps";
DROP TABLE "github_apps";
DROP TABLE "cdx";
DROP TABLE "findings";
DROP TABLE "git_repos";
DROP TABLE "integration_usage_log";
DROP TABLE "sarif";
DROP TABLE "sarif_results";
DROP TABLE "spdx";
DROP TABLE "triage_activity";
DROP TABLE "sessions";
CREATE TABLE "Session" (
    "kid" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "expiry" INTEGER NOT NULL,
    "issued" INTEGER NOT NULL,
    "secret" TEXT,
    "authn_ip" TEXT,
    "authn_ua" TEXT
);
CREATE TABLE "GitRepo" (
    "orgId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ghid" INTEGER,
    "source" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "pushedAt" INTEGER NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "licenseSpdxId" TEXT,
    "licenseName" TEXT,
    "fork" INTEGER NOT NULL DEFAULT 0,
    "template" INTEGER NOT NULL DEFAULT 0,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL,
    "avatarUrl" TEXT,
    PRIMARY KEY ("fullName", "orgId")
);
CREATE TABLE "SARIFInfo" (
    "sarifId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT,
    "source" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "commitSha" TEXT,
    "ref" TEXT,
    "createdAt" INTEGER NOT NULL,
    "resultsCount" INTEGER NOT NULL,
    "rulesCount" INTEGER NOT NULL,
    "toolName" TEXT,
    "toolVersion" TEXT,
    "analysisKey" TEXT,
    "warning" TEXT
);
CREATE TABLE "SarifResults" (
    "guid" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "locations" TEXT,
    "automationDetailsId" TEXT,
    "rulesetName" TEXT,
    "level" TEXT,
    "description" TEXT,
    "helpMarkdown" TEXT,
    "securitySeverity" TEXT,
    "precision" TEXT,
    "tags" TEXT
);
CREATE TABLE "CycloneDXInfo" (
    "cdxId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "repoName" TEXT,
    "cdxVersion" TEXT NOT NULL,
    "serialNumber" TEXT,
    "name" TEXT,
    "version" TEXT,
    "createdAt" INTEGER NOT NULL,
    "toolName" TEXT,
    "externalReferencesCount" INTEGER NOT NULL,
    "componentsCount" INTEGER NOT NULL,
    "dependenciesCount" INTEGER NOT NULL
);
CREATE TABLE "SPDXInfo" (
    "spdxId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "repoName" TEXT,
    "spdxVersion" TEXT NOT NULL,
    "dataLicense" TEXT,
    "name" TEXT,
    "documentNamespace" TEXT,
    "createdAt" INTEGER NOT NULL,
    "toolName" TEXT,
    "documentDescribes" TEXT,
    "packagesCount" INTEGER NOT NULL,
    "comment" TEXT
);
CREATE TABLE "IntegrationUsageLog" (
    "orgId" TEXT NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "response" TEXT,
    "statusCode" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL
);
CREATE TABLE "Finding" (
    "uuid" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "repoName" TEXT,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
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
    "packageLicense" TEXT,
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
    "maliciousSource" TEXT,
    "abandoned" INTEGER,
    "squattedPackage" TEXT,
    "referencesJSON" TEXT,
    "spdxId" TEXT,
    "cdxId" TEXT
);
CREATE TABLE "Triage" (
    "uuid" TEXT NOT NULL,
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
    "memberEmail" TEXT
);
DROP TABLE IF EXISTS "Artifact";
CREATE TABLE "Artifact" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "displayIdentifier" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "date" INTEGER NOT NULL,
    "bomFormat" TEXT NOT NULL,
    "inventoryTypes" TEXT NOT NULL
);
DROP TABLE IF EXISTS "Link";
CREATE TABLE "Link" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "artifactUuid" TEXT NOT NULL,
    CONSTRAINT "Link_artifactUuid_fkey" FOREIGN KEY ("artifactUuid") REFERENCES "Artifact" ("uuid") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_kid_key" ON "Session"("kid");
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
CREATE UNIQUE INDEX "MemberKey_memberEmail_secret_key" ON "MemberKey"("memberEmail", "secret");
CREATE UNIQUE INDEX "GitHubPAT_keyId_key" ON "GitHubPAT"("keyId");
CREATE UNIQUE INDEX "GitHubApp_installationId_key" ON "GitHubApp"("installationId");
CREATE UNIQUE INDEX "SARIFInfo_sarifId_key" ON "SARIFInfo"("sarifId");
CREATE UNIQUE INDEX "SarifResults_guid_key" ON "SarifResults"("guid");
CREATE UNIQUE INDEX "CycloneDXInfo_cdxId_key" ON "CycloneDXInfo"("cdxId");
CREATE UNIQUE INDEX "SPDXInfo_spdxId_key" ON "SPDXInfo"("spdxId");
CREATE UNIQUE INDEX "Finding_uuid_key" ON "Finding"("uuid");
CREATE UNIQUE INDEX "Triage_uuid_key" ON "Triage"("uuid");
