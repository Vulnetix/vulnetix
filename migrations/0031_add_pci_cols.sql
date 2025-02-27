ALTER TABLE "TestingProcedure" ADD "title" TEXT;
ALTER TABLE "Report" ADD "reportTypeId" TEXT NOT NULL;
ALTER TABLE "RequirementResult" ADD "automatedAssessment" INT DEFAULT 1; -- 0 means customer manually assessed
ALTER TABLE "RequirementResult" ADD "automatedEvidence" INT DEFAULT 0; -- 1 means Vulnetix needed no customer assistance
ALTER TABLE "RequirementScope" ADD "confirmed" INT DEFAULT 0;
ALTER TABLE "Org" ADD "createdAt" INT;
UPDATE "Org" SET "createdAt" = 1740656581;
ALTER TABLE "Member" ADD "createdAt" INT;
UPDATE "Member" SET "createdAt" = 1740656581;
