DROP INDEX IF EXISTS "Leaf_tei_key";
DROP INDEX IF EXISTS "MemberKey_memberEmail_secret_key";
DROP INDEX IF EXISTS "Session_orgId_memberEmail_idx";
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "Leaf";
DROP TABLE IF EXISTS "Triage2";
DROP TABLE IF EXISTS "Session2";
DROP TABLE IF EXISTS "MemberKey2";
DROP TABLE IF EXISTS "IntegrationUsageLog2";
DROP TABLE IF EXISTS "Product";
DROP TABLE IF EXISTS "ProductRepos";
DROP TABLE IF EXISTS "ProductTags";
DROP TABLE IF EXISTS "Collection";
PRAGMA foreign_keys=on;

CREATE TABLE "Collection" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "parentUuid" TEXT,
    "ownerEmail" TEXT,
    "leadEmail" TEXT,
    "triagePolicyId" TEXT,
    "releaseBranch" TEXT,
    "deadline" INTEGER,
    "description" TEXT,
    "cweList" TEXT,
    "findingAliases" TEXT,
    "keywords" TEXT,
    "cvssThreshold" REAL,
    "createdAt" INTEGER NOT NULL
);

CREATE TABLE "CollectionTag" (
    "collectionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("collectionId", "tagId")
);

CREATE TABLE "CollectionRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionId" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "orgId" TEXT NOT NULL
);

CREATE TABLE "CollectionArtifact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionId" TEXT NOT NULL,
    "artifactUuid" TEXT NOT NULL
);

CREATE TABLE "CollectionMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionId" TEXT NOT NULL,
    "memberUuid" TEXT NOT NULL,
    "title" TEXT
);

CREATE TABLE "CollectionTeam" (
    "productId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    PRIMARY KEY ("productId", "teamId")
);

CREATE TABLE "CollectionProject" (
    "productId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    PRIMARY KEY ("productId", "projectId")
);
