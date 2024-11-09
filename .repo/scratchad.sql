-- PRAGMA table_list;
-- PRAGMA table_info(Artifact);
-- DELETE FROM Artifact;
-- SELECT * FROM IntegrationConfig -- ORDER BY `date` DESC LIMIT 10;
-- UPDATE Finding SET malicious = 0;
-- SELECT * FROM SPDXInfo LIMIT 10;
-- SELECT DISTINCT malicious FROM Finding;
-- ALTER TABLE Finding DROP COLUMN malicious;
-- ALTER TABLE Finding ADD malicious INTEGER;
DELETE FROM Triage
WHERE uuid = "c1e28157-ba4c-4eef-989d-4ad7195104f1";
SELECT *
FROM Triage
WHERE findingUuid = "c00f2661-a1fc-4a72-83af-5894580ee510";
