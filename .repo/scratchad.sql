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
SELECT *
FROM Finding
WHERE affectedFunctions IS NOT NULL;
