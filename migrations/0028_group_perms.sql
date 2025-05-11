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

INSERT INTO "Group" ("uuid", "name")
VALUES
    ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d4", "Owner"),
    ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d7", "Audit"),
    ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d5", "Internal Support"),
    ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d6", "Internal Admin"),
    ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d8", "Triage");

INSERT INTO "MemberGroups" ("groupUuid", "memberUuid")
SELECT 
    "8ac52122-b9ae-40fb-b4c6-7c83238ae8d4" as "groupUuid",
    m."uuid" as "memberUuid"
FROM (
    SELECT 
        "uuid", 
        "orgId", 
        "createdAt",
        ROW_NUMBER() OVER (PARTITION BY "orgId" ORDER BY "createdAt" ASC) as row_num
    FROM "Member"
) m
WHERE m.row_num = 1
AND NOT EXISTS (
    SELECT 1 
    FROM "MemberGroups" mg 
    WHERE mg."memberUuid" = m."uuid" 
    AND mg."groupUuid" = "8ac52122-b9ae-40fb-b4c6-7c83238ae8d4"
);
