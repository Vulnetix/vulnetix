-- SELECT * FROM IntegrationConfig -- ORDER BY `date` DESC LIMIT 10;
-- UPDATE Finding SET malicious = 0;
-- ALTER TABLE Finding DROP COLUMN malicious;
-- ALTER TABLE Finding ADD malicious INTEGER;
--
-- DELETE FROM Finding;
-- DELETE FROM Triage;
-- DELETE FROM GitRepo;
-- DELETE FROM SARIFInfo;
-- DELETE FROM SarifResults;
-- DELETE FROM CycloneDXInfo;
-- DELETE FROM SPDXInfo;
-- DELETE FROM IntegrationUsageLog;
-- DELETE FROM Link;
-- DELETE FROM Artifact;
-- DELETE FROM Dependency;
-- SELECT DISTINCT malicious FROM Finding;
--
SELECT
  o.name AS organisation,
  m.email AS email,
  m.firstName AS firstName,
  m.lastName AS lastName,
  (SELECT COUNT(1) FROM GitHubApp WHERE orgId = o.uuid) AS appInstalls,
  (SELECT COUNT(1) FROM GitHubPAT WHERE orgId = o.uuid) AS ghTokens,
  (SELECT COUNT(1) FROM GitRepo WHERE orgId = o.uuid) AS repos,
  (SELECT COUNT(1) FROM CycloneDXInfo WHERE orgId = o.uuid) AS cdx,
  (SELECT COUNT(1) FROM SPDXInfo WHERE orgId = o.uuid) AS spdx,
  (SELECT COUNT(1) FROM SARIFInfo WHERE orgId = o.uuid) AS sarif,
  (SELECT COUNT(1) FROM `Session` WHERE orgId = o.uuid) AS sessions,
  DATETIME((SELECT createdAt FROM IntegrationUsageLog WHERE orgId = o.uuid ORDER BY createdAt DESC LIMIT 1)/1000, 'unixepoch') AS lastSync,
  o.uuid AS orgUuid,
  m.uuid AS memberUuid
FROM
  Org o
LEFT JOIN Member m ON o.uuid = m.orgId
ORDER BY o.uuid;

WITH vars AS (
    SELECT '045B7C81-B05E-4275-B54A-2828ED335EEE' as orgId
)
SELECT
    (SELECT COUNT(1) FROM IntegrationConfig WHERE orgId = vars.orgId) as configs,
    (SELECT COUNT(1) FROM IntegrationUsageLog WHERE orgId = vars.orgId) as logs,
    (SELECT COUNT(1) FROM Product WHERE orgId = vars.orgId) as products,
    (SELECT COUNT(1) FROM ProductRepos WHERE orgId = vars.orgId) as "repo product links",
    (SELECT COUNT(1) FROM SARIFInfo WHERE orgId = vars.orgId) as SARIF,
    (SELECT COUNT(1) FROM CycloneDXInfo WHERE orgId = vars.orgId) as CycloneDX,
    (SELECT COUNT(1) FROM SPDXInfo WHERE orgId = vars.orgId) as SPDX,
    (SELECT COUNT(1) FROM GitBranch WHERE orgId = vars.orgId) as branches,
    (SELECT COUNT(1) FROM GitHubApp WHERE orgId = vars.orgId) as apps,
    (SELECT COUNT(1) FROM GitHubOAuth WHERE orgId = vars.orgId) as oauths,
    (SELECT COUNT(1) FROM GitHubPAT WHERE orgId = vars.orgId) as tokens,
    (SELECT COUNT(1) FROM Member WHERE orgId = vars.orgId) as members,
    (SELECT COUNT(1) FROM `Session` WHERE orgId = vars.orgId) as "sessions",
    (SELECT COUNT(1) FROM Finding WHERE orgId = vars.orgId) as findings
FROM vars;
