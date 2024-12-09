CREATE INDEX "Member_orgId_email_idx" ON "Member"("orgId", "email");
CREATE INDEX "Session_orgId_memberEmail_idx" ON "Session"("orgId", "memberEmail");
CREATE UNIQUE INDEX "Org_name_key" ON "Org"("name");
