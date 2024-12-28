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
