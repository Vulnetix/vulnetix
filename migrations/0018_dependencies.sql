CREATE TABLE "Dependency" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
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
    "dependsOnUuid" TEXT,
    "spdxId" TEXT,
    "cdxId" TEXT
);
CREATE TABLE "new_SPDXInfo" (
    "spdxId" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
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
        "memberEmail",
        "name",
        "orgId",
        "repoName",
        "source",
        "spdxId",
        "spdxVersion",
        "toolName"
    )
SELECT "artifactUuid",
    "comment",
    "createdAt",
    "dataLicense",
    "documentDescribes",
    "documentNamespace",
    "memberEmail",
    "name",
    "orgId",
    "repoName",
    "source",
    "spdxId",
    "spdxVersion",
    "toolName"
FROM "SPDXInfo";
DROP TABLE "SPDXInfo";
ALTER TABLE "new_SPDXInfo"
    RENAME TO "SPDXInfo";
ALTER TABLE CycloneDXInfo DROP COLUMN componentsCount;
