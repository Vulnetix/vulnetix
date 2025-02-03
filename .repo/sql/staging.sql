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
        "18f55ff2-cd8e-4c31-8d62-43bc60d3117e",
        "8cb6de92-71f8-4a09-81bc-b9181d127db6",
        "d6585822-0a2d-4199-827f-e77563518829",
        1824893666954,
        1735401968528,
        "REPLACEME"
    );
