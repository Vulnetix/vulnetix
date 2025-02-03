PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GitRepo" (
    "fullName" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ghAppId" INTEGER,
    "ghPATId" INTEGER,
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
INSERT INTO "new_GitRepo" ("archived", "avatarUrl", "createdAt", "defaultBranch", "fork", "fullName", "ghid", "licenseName", "licenseSpdxId", "orgId", "ownerId", "pushedAt", "source", "template", "updatedAt", "visibility") SELECT "archived", "avatarUrl", "createdAt", "defaultBranch", "fork", "fullName", "ghid", "licenseName", "licenseSpdxId", "orgId", "ownerId", "pushedAt", "source", "template", "updatedAt", "visibility" FROM "GitRepo";
DROP TABLE "GitRepo";
ALTER TABLE "new_GitRepo" RENAME TO "GitRepo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
