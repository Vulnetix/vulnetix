PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_github_apps" (
    "installationId" INTEGER NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "login" TEXT,
    "created" INTEGER NOT NULL,
    "expires" INTEGER,
    "avatarUrl" TEXT
);
INSERT INTO "new_github_apps" ("accessToken", "created", "expires", "installationId", "login", "memberEmail") SELECT "accessToken", "created", "expires", "installationId", "login", "memberEmail" FROM "github_apps";
DROP TABLE "github_apps";
ALTER TABLE "new_github_apps" RENAME TO "github_apps";
CREATE UNIQUE INDEX "github_apps_installationId_key" ON "github_apps"("installationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
