ALTER TABLE Triage ADD cvssSource TEXT default 'CVE.org';
ALTER TABLE "Report" ADD COLUMN "collectionId" TEXT;
CREATE TABLE "GitRepoContributor" (
    "repoName" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "type" TEXT NOT NULL,
    "siteAdmin" INTEGER NOT NULL DEFAULT 0,
    "contributions" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,

    PRIMARY KEY ("repoName", "orgId")
);

CREATE INDEX "GitRepoContributor_repoName_orgId_idx" ON "GitRepoContributor"("repoName", "orgId");

CREATE TABLE "Languages" (
    "uuid" TEXT NOT NULL PRIMARY KEY DEFAULT (hex(randomblob(16))),
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "githubId" TEXT
);

CREATE INDEX "Languages_slug_idx" ON "Languages"("slug");

CREATE TABLE "GitRepoLanguage" (
    "repoName" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "languageUuid" TEXT NOT NULL,

    PRIMARY KEY ("repoName", "orgId", "languageUuid")
);

CREATE INDEX "GitRepoLanguage_repoName_orgId_idx" ON "GitRepoLanguage"("repoName", "orgId");
CREATE INDEX "GitRepoLanguage_languageUuid_idx" ON "GitRepoLanguage"("languageUuid");
