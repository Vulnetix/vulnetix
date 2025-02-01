CREATE TABLE "Group" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);
CREATE TABLE "MemberGroups" (
    "groupUuid" TEXT NOT NULL,
    "memberUuid" TEXT NOT NULL
);

CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");
CREATE UNIQUE INDEX "MemberGroups_groupUuid_memberUuid_key" ON "MemberGroups"("groupUuid", "memberUuid");
