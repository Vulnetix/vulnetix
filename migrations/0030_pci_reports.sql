-- CreateTable
CREATE TABLE "Report" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "lastGenerated" INTEGER NOT NULL,
    "initialDate" INTEGER NOT NULL,
    "assessmentDueDate" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "orgId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ReportType" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ReportingInstructions" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Requirement" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "reportTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TestingProcedure" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "reportTypeId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "description" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RequirementResult" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "requirementId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "assessmentFinding" TEXT NOT NULL DEFAULT 'Not Tested',
    "method" TEXT,
    "step1" TEXT NOT NULL DEFAULT '',
    "step2" TEXT NOT NULL DEFAULT '',
    "step3" TEXT NOT NULL DEFAULT '',
    "step4" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "RequirementScope" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "requirementResultId" TEXT NOT NULL,
    "repoName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TestingProcedureResult" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "testingProcedureId" TEXT NOT NULL,
    "requirementResultId" TEXT NOT NULL,
    "reportingDetails" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_TestingProcedureEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_TestingProcedureInstructions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TestingProcedureEvidence_AB_unique" ON "_TestingProcedureEvidence"("A", "B");

-- CreateIndex
CREATE INDEX "_TestingProcedureEvidence_B_index" ON "_TestingProcedureEvidence"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TestingProcedureInstructions_AB_unique" ON "_TestingProcedureInstructions"("A", "B");

-- CreateIndex
CREATE INDEX "_TestingProcedureInstructions_B_index" ON "_TestingProcedureInstructions"("B");
