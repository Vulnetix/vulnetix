CREATE TABLE "GitHubOAuth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orgId" TEXT NOT NULL,
    "memberUuid" TEXT,
    "login" TEXT,
    "accessToken" TEXT NOT NULL,
    "created" INTEGER NOT NULL,
    "expires" INTEGER,
    "installationId" INTEGER
);


CREATE TABLE "new_GitHubApp" (
    "installationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orgId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "created" INTEGER NOT NULL,
    "avatarUrl" TEXT
);
INSERT INTO "new_GitHubApp" ("avatarUrl", "created", "installationId", "orgId", "identifier", "identifierType")
SELECT "avatarUrl", "created", "installationId", "orgId", "login" as "identifier", "user" as "identifierType" FROM "GitHubApp";
DROP TABLE "GitHubApp";
ALTER TABLE "new_GitHubApp" RENAME TO "GitHubApp";


CREATE TABLE "new_GitHubPAT" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "avatarUrl" TEXT
);
INSERT INTO "new_GitHubPAT" ("avatarUrl", "created", "expires", "login", "orgId", "token", "uuid") SELECT "avatarUrl", "created", "expires", "login", "orgId", "token", "uuid" FROM "GitHubPAT";
DROP TABLE "GitHubPAT";
ALTER TABLE "new_GitHubPAT" RENAME TO "GitHubPAT";


CREATE TABLE "new_Member" (
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
INSERT INTO "new_Member" ("alertFindings", "alertNews", "alertOverdue", "alertType", "avatarUrl", "email", "firstName", "lastName", "orgId", "passwordHash", "uuid") SELECT "alertFindings", "alertNews", "alertOverdue", "alertType", "avatarUrl", "email", "firstName", "lastName", "orgId", "passwordHash", "uuid" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_orgId_email_idx" ON "Member"("orgId", "email");


CREATE TABLE "new_MemberKey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyLabel" TEXT,
    "keyType" TEXT NOT NULL,
    "memberUuid" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "suspend" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_MemberKey" ("id", "keyLabel", "keyType", "memberUuid", "secret", "suspend") SELECT "id", "keyLabel", "keyType", "memberUuid", "secret", "suspend" FROM "MemberKey";
DROP TABLE "MemberKey";
ALTER TABLE "new_MemberKey" RENAME TO "MemberKey";
CREATE UNIQUE INDEX "MemberKey_memberUuid_secret_key" ON "MemberKey"("memberUuid", "secret");


CREATE TABLE "new_Session" (
    "kid" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "memberUuid" TEXT NOT NULL,
    "expiry" INTEGER NOT NULL,
    "issued" INTEGER NOT NULL,
    "secret" TEXT,
    "authn_ip" TEXT,
    "authn_ua" TEXT
);
INSERT INTO "new_Session" ("authn_ip", "authn_ua", "expiry", "issued", "kid", "memberUuid", "orgId", "secret") SELECT "authn_ip", "authn_ua", "expiry", "issued", "kid", "memberUuid", "orgId", "secret" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_orgId_memberUuid_idx" ON "Session"("orgId", "memberUuid");
