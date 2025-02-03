DROP TABLE "GitHubPAT";
CREATE TABLE "GitHubPAT" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "avatarUrl" TEXT
);
CREATE TABLE "new_MemberKey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyLabel" TEXT,
    "keyType" TEXT NOT NULL,
    "memberUuid" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "suspend" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_MemberKey" (
        "id",
        "keyLabel",
        "keyType",
        "memberUuid",
        "secret",
        "suspend"
    )
SELECT "id",
    "keyLabel",
    "keyType",
    "memberUuid",
    "secret",
    "suspend"
FROM "MemberKey";
DROP TABLE "MemberKey";
ALTER TABLE "new_MemberKey" RENAME TO "MemberKey";
CREATE UNIQUE INDEX "MemberKey_memberUuid_secret_key" ON "MemberKey"("memberUuid", "secret");
