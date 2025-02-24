INSERT INTO Org (uuid, name)
VALUES ("8cb6de92-71f8-4a09-81bc-b9181d127db6", "Demo");
INSERT INTO Member (uuid, email, orgId, firstName, lastName)
VALUES (
        "d6585822-0a2d-4199-827f-e77563518829",
        "support@vulnetix.com",
        "8cb6de92-71f8-4a09-81bc-b9181d127db6",
        "Demo",
        "User"
    );
INSERT INTO `Session` (kid, orgId, memberUuid, expiry, issued, `secret`)
VALUES (
        lower(
            hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' ||
            substr(hex( randomblob(2)), 2) || '-' ||
            substr('AB89', 1 + (abs(random()) % 4) , 1)  ||
            substr(hex(randomblob(2)), 2) || '-' ||
            hex(randomblob(6))
        ),
        "8cb6de92-71f8-4a09-81bc-b9181d127db6",
        "d6585822-0a2d-4199-827f-e77563518829",
        1824893666954,
        1735401968528,
        "REPLACEME"
    );
INSERT INTO `Group` (uuid, `name`)
VALUES ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d4", "Owner"),
       ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d5", "Internal Support"),
       ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d6", "Internal Admin"),
       ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d7", "Audit"),
       ("8ac52122-b9ae-40fb-b4c6-7c83238ae8d8", "Triage");
INSERT INTO MemberGroups (memberUuid, groupUuid)
VALUES ("d6585822-0a2d-4199-827f-e77563518829", "8ac52122-b9ae-40fb-b4c6-7c83238ae8d4");
