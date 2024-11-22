-- PRAGMA table_list;
-- PRAGMA table_info(Artifact);
-- DELETE FROM Artifact;
-- SELECT * FROM IntegrationConfig -- ORDER BY `date` DESC LIMIT 10;
-- UPDATE Finding SET malicious = 0;
-- SELECT * FROM SPDXInfo LIMIT 10;
-- SELECT DISTINCT malicious FROM Finding;
-- ALTER TABLE Finding DROP COLUMN malicious;
-- ALTER TABLE Finding ADD malicious INTEGER;
-- SELECT *
-- FROM Triage
-- WHERE findingUuid = "c00f2661-a1fc-4a72-83af-5894580ee510";
--
-- SELECT *
-- FROM `Dependency`
-- WHERE `cdxId` = "141a4b7cfe7265df570652e5a4e348fcbd9168a0";
DELETE FROM Finding;
DELETE FROM Triage;
DELETE FROM GitRepo;
DELETE FROM SARIFInfo;
DELETE FROM SarifResults;
DELETE FROM CycloneDXInfo;
DELETE FROM SPDXInfo;
DELETE FROM IntegrationUsageLog;
DELETE FROM Link;
DELETE FROM Artifact;
DELETE FROM Dependency;
