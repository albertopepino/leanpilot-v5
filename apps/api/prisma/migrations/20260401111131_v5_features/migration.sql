-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'delivery',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "tierLevel" INTEGER,
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_meetings" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "shift" TEXT,
    "leaderId" TEXT NOT NULL,
    "attendees" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tier_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_meeting_items" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'green',
    "metric" TEXT,
    "value" TEXT,
    "target" TEXT,
    "comment" TEXT,
    "actionId" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tier_meeting_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "a3_reports" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sponsorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "background" TEXT,
    "currentCondition" TEXT,
    "targetCondition" TEXT,
    "gapAnalysis" TEXT,
    "rootCauseAnalysis" TEXT,
    "fiveWhyId" TEXT,
    "ishikawaId" TEXT,
    "countermeasures" TEXT,
    "implementationPlan" TEXT,
    "confirmationMethod" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "categoryTag" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "a3_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'technical',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "certifiedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "assessedById" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smed_analyses" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productFrom" TEXT,
    "productTo" TEXT,
    "analystId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recording',
    "baselineMinutes" INTEGER,
    "targetMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smed_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smed_activities" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'internal',
    "durationSeconds" INTEGER NOT NULL,
    "canConvert" BOOLEAN NOT NULL DEFAULT false,
    "convertedTo" TEXT DEFAULT 'internal',
    "improvement" TEXT,

    CONSTRAINT "smed_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actions_siteId_idx" ON "actions"("siteId");

-- CreateIndex
CREATE INDEX "actions_status_idx" ON "actions"("status");

-- CreateIndex
CREATE INDEX "actions_assigneeId_idx" ON "actions"("assigneeId");

-- CreateIndex
CREATE INDEX "actions_dueDate_idx" ON "actions"("dueDate");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_siteId_idx" ON "notifications"("siteId");

-- CreateIndex
CREATE INDEX "tier_meetings_siteId_date_idx" ON "tier_meetings"("siteId", "date");

-- CreateIndex
CREATE INDEX "a3_reports_siteId_idx" ON "a3_reports"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_siteId_name_key" ON "skills"("siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_userId_skillId_key" ON "user_skills"("userId", "skillId");

-- CreateIndex
CREATE INDEX "smed_analyses_siteId_idx" ON "smed_analyses"("siteId");

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tier_meetings" ADD CONSTRAINT "tier_meetings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tier_meetings" ADD CONSTRAINT "tier_meetings_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tier_meeting_items" ADD CONSTRAINT "tier_meeting_items_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "tier_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "a3_reports" ADD CONSTRAINT "a3_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "a3_reports" ADD CONSTRAINT "a3_reports_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "a3_reports" ADD CONSTRAINT "a3_reports_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smed_analyses" ADD CONSTRAINT "smed_analyses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smed_analyses" ADD CONSTRAINT "smed_analyses_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smed_analyses" ADD CONSTRAINT "smed_analyses_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smed_activities" ADD CONSTRAINT "smed_activities_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "smed_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
