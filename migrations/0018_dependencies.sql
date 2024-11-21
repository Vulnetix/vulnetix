CREATE TABLE "Dependency" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "license" TEXT,
    "packageEcosystem" TEXT,
    "isDev" INTEGER NOT NULL DEFAULT 0,
    "isDirect" INTEGER NOT NULL DEFAULT 0,
    "isIndirect" INTEGER NOT NULL DEFAULT 0,
    "isTransitive" INTEGER NOT NULL DEFAULT 0,
    "isShared" INTEGER NOT NULL DEFAULT 0,
    "isPeer" INTEGER NOT NULL DEFAULT 0,
    "childOfKey" TEXT,
    "spdxId" TEXT,
    "cdxId" TEXT
);
CREATE UNIQUE INDEX "Dependency_key_key" ON "Dependency"("key");
CREATE UNIQUE INDEX "Dependency_name_version_spdxId_key" ON "Dependency"("name", "version", "spdxId");
CREATE UNIQUE INDEX "Dependency_name_version_cdxId_key" ON "Dependency"("name", "version", "cdxId");
CREATE TABLE "new_CycloneDXInfo" (
    "cdxId" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "repoName" TEXT,
    "artifactUuid" TEXT NOT NULL,
    "cdxVersion" TEXT NOT NULL,
    "serialNumber" TEXT,
    "name" TEXT,
    "version" TEXT,
    "createdAt" INTEGER NOT NULL,
    "toolName" TEXT
);
INSERT INTO "new_CycloneDXInfo" (
        "artifactUuid",
        "cdxId",
        "cdxVersion",
        "createdAt",
        "name",
        "orgId",
        "repoName",
        "serialNumber",
        "source",
        "toolName",
        "version"
    )
SELECT "artifactUuid",
    "cdxId",
    "cdxVersion",
    "createdAt",
    "name",
    "orgId",
    "repoName",
    "serialNumber",
    "source",
    "toolName",
    "version"
FROM "CycloneDXInfo";
DROP TABLE "CycloneDXInfo";
ALTER TABLE "new_CycloneDXInfo"
    RENAME TO "CycloneDXInfo";
CREATE TABLE "new_Finding" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "repoName" TEXT,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "modifiedAt" INTEGER NOT NULL,
    "publishedAt" INTEGER,
    "detectionTitle" TEXT NOT NULL,
    "detectionDescription" TEXT,
    "purl" TEXT,
    "cpe" TEXT,
    "databaseReviewed" INTEGER,
    "aliases" TEXT,
    "cwes" TEXT,
    "packageName" TEXT NOT NULL,
    "packageVersion" TEXT,
    "packageLicense" TEXT,
    "vendor" TEXT,
    "product" TEXT,
    "packageEcosystem" TEXT,
    "customCvssVector" TEXT,
    "customCvssScore" TEXT,
    "advisoryUrl" TEXT,
    "exploitsJSON" TEXT,
    "knownExploitsJSON" TEXT,
    "cisaDateAdded" INTEGER,
    "knownRansomwareCampaignUse" TEXT,
    "fixVersion" TEXT,
    "fixAutomatable" INTEGER,
    "vulnerableVersionRange" TEXT,
    "affectedFunctions" TEXT,
    "malicious" INTEGER,
    "abandoned" INTEGER,
    "squattedPackage" TEXT,
    "referencesJSON" TEXT,
    "timelineJSON" TEXT,
    "confidenceScore" TEXT,
    "confidenceLevel" TEXT,
    "confidenceRationaleJSON" TEXT,
    "spdxId" TEXT,
    "cdxId" TEXT
);
INSERT INTO "new_Finding" (
        "abandoned",
        "advisoryUrl",
        "affectedFunctions",
        "aliases",
        "category",
        "cdxId",
        "cisaDateAdded",
        "confidenceLevel",
        "confidenceRationaleJSON",
        "confidenceScore",
        "cpe",
        "createdAt",
        "customCvssScore",
        "customCvssVector",
        "cwes",
        "databaseReviewed",
        "detectionDescription",
        "detectionTitle",
        "exploitsJSON",
        "findingId",
        "fixAutomatable",
        "fixVersion",
        "knownExploitsJSON",
        "knownRansomwareCampaignUse",
        "malicious",
        "modifiedAt",
        "orgId",
        "packageEcosystem",
        "packageLicense",
        "packageName",
        "packageVersion",
        "product",
        "publishedAt",
        "purl",
        "referencesJSON",
        "repoName",
        "source",
        "spdxId",
        "squattedPackage",
        "timelineJSON",
        "uuid",
        "vendor",
        "vulnerableVersionRange"
    )
SELECT "abandoned",
    "advisoryUrl",
    "affectedFunctions",
    "aliases",
    "category",
    "cdxId",
    "cisaDateAdded",
    "confidenceLevel",
    "confidenceRationaleJSON",
    "confidenceScore",
    "cpe",
    "createdAt",
    "customCvssScore",
    "customCvssVector",
    "cwes",
    "databaseReviewed",
    "detectionDescription",
    "detectionTitle",
    "exploitsJSON",
    "findingId",
    "fixAutomatable",
    "fixVersion",
    "knownExploitsJSON",
    "knownRansomwareCampaignUse",
    "malicious",
    "modifiedAt",
    "orgId",
    "packageEcosystem",
    "packageLicense",
    "packageName",
    "packageVersion",
    "product",
    "publishedAt",
    "purl",
    "referencesJSON",
    "repoName",
    "source",
    "spdxId",
    "squattedPackage",
    "timelineJSON",
    "uuid",
    "vendor",
    "vulnerableVersionRange"
FROM "Finding";
DROP TABLE "Finding";
ALTER TABLE "new_Finding"
    RENAME TO "Finding";
CREATE TABLE "new_GitHubApp" (
    "installationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orgId" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "login" TEXT,
    "created" INTEGER NOT NULL,
    "expires" INTEGER,
    "avatarUrl" TEXT
);
INSERT INTO "new_GitHubApp" (
        "accessToken",
        "avatarUrl",
        "created",
        "expires",
        "installationId",
        "login",
        "memberEmail",
        "orgId"
    )
SELECT "accessToken",
    "avatarUrl",
    "created",
    "expires",
    "installationId",
    "login",
    "memberEmail",
    (
        SELECT "orgId"
        FROM "Member"
        WHERE "email" = memberEmail
        LIMIT 1
    )
FROM "GitHubApp";
DROP TABLE "GitHubApp";
ALTER TABLE "new_GitHubApp"
    RENAME TO "GitHubApp";
CREATE TABLE "new_GitRepo" (
    "fullName" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ghid" INTEGER,
    "source" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "pushedAt" INTEGER NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "licenseSpdxId" TEXT,
    "licenseName" TEXT,
    "fork" INTEGER NOT NULL DEFAULT 0,
    "template" INTEGER NOT NULL DEFAULT 0,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL,
    "avatarUrl" TEXT,
    PRIMARY KEY ("fullName", "orgId")
);
INSERT INTO "new_GitRepo" (
        "archived",
        "avatarUrl",
        "createdAt",
        "defaultBranch",
        "fork",
        "fullName",
        "ghid",
        "licenseName",
        "licenseSpdxId",
        "orgId",
        "ownerId",
        "pushedAt",
        "source",
        "template",
        "updatedAt",
        "visibility"
    )
SELECT "archived",
    "avatarUrl",
    "createdAt",
    "defaultBranch",
    "fork",
    "fullName",
    "ghid",
    "licenseName",
    "licenseSpdxId",
    "orgId",
    "ownerId",
    "pushedAt",
    "source",
    "template",
    "updatedAt",
    "visibility"
FROM "GitRepo";
DROP TABLE "GitRepo";
ALTER TABLE "new_GitRepo"
    RENAME TO "GitRepo";
CREATE TABLE "new_SARIFInfo" (
    "reportId" TEXT NOT NULL PRIMARY KEY,
    "sarifId" TEXT NOT NULL,
    "fullName" TEXT,
    "orgId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "artifactUuid" TEXT NOT NULL,
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
INSERT INTO "new_SARIFInfo" (
        "analysisKey",
        "artifactUuid",
        "commitSha",
        "createdAt",
        "fullName",
        "orgId",
        "ref",
        "reportId",
        "resultsCount",
        "rulesCount",
        "sarifId",
        "source",
        "toolName",
        "toolVersion",
        "warning"
    )
SELECT "analysisKey",
    "artifactUuid",
    "commitSha",
    "createdAt",
    "fullName",
    "orgId",
    "ref",
    "reportId",
    "resultsCount",
    "rulesCount",
    "sarifId",
    "source",
    "toolName",
    "toolVersion",
    "warning"
FROM "SARIFInfo";
DROP TABLE "SARIFInfo";
ALTER TABLE "new_SARIFInfo"
    RENAME TO "SARIFInfo";
CREATE TABLE "new_SPDXInfo" (
    "spdxId" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "repoName" TEXT,
    "artifactUuid" TEXT NOT NULL,
    "spdxVersion" TEXT NOT NULL,
    "dataLicense" TEXT,
    "name" TEXT,
    "version" TEXT,
    "documentNamespace" TEXT,
    "createdAt" INTEGER NOT NULL,
    "toolName" TEXT,
    "documentDescribes" TEXT,
    "comment" TEXT
);
INSERT INTO "new_SPDXInfo" (
        "artifactUuid",
        "comment",
        "createdAt",
        "dataLicense",
        "documentDescribes",
        "documentNamespace",
        "name",
        "orgId",
        "repoName",
        "source",
        "spdxId",
        "spdxVersion",
        "toolName",
        "version"
    )
SELECT "artifactUuid",
    "comment",
    "createdAt",
    "dataLicense",
    "documentDescribes",
    "documentNamespace",
    "name",
    "orgId",
    "repoName",
    "source",
    "spdxId",
    "spdxVersion",
    "toolName",
    "version"
FROM "SPDXInfo";
DROP TABLE "SPDXInfo";
ALTER TABLE "new_SPDXInfo"
    RENAME TO "SPDXInfo";
