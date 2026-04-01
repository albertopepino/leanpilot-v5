-- CreateTable
CREATE TABLE "corporates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "corporateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "siteId" TEXT NOT NULL,
    "corporateId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "result" TEXT NOT NULL DEFAULT 'success',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workstations" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'machine',
    "area" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "criticality" TEXT NOT NULL DEFAULT 'B',
    "assetTag" TEXT,
    "equipmentStatus" TEXT NOT NULL DEFAULT 'operational',
    "photoUrl" TEXT,
    "plannedHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "parentId" TEXT,

    CONSTRAINT "workstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reason_codes" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#gray',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reason_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_definitions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "days" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shift_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'released',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_phases" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "cycleTimeSeconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "production_order_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_runs" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "shiftDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "producedQuantity" INTEGER NOT NULL DEFAULT 0,
    "scrapQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workstation_events" (
    "id" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "productionRunId" TEXT,
    "operatorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT,
    "reasonCode" TEXT,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workstation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gemba_walks" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "walkerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "gemba_walks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gemba_observations" (
    "id" TEXT NOT NULL,
    "walkId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "workstationId" TEXT,
    "wasteCategory" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "operatorQuote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "escalatedTo" TEXT,
    "actionRequired" TEXT,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gemba_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "five_s_audits" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 30,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "five_s_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "five_s_scores" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "five_s_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_ideas" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "proposedSolution" TEXT,
    "expectedImpact" TEXT NOT NULL DEFAULT 'medium',
    "area" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "implementedAt" TIMESTAMP(3),
    "result" TEXT,
    "photoUrl" TEXT,
    "expectedSavings" DOUBLE PRECISION,
    "actualSavings" DOUBLE PRECISION,
    "costToImplement" DOUBLE PRECISION,
    "savingsType" TEXT,
    "gembaObservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kaizen_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_templates" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productName" TEXT,
    "phase" TEXT,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checkpoints" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "measurementType" TEXT NOT NULL DEFAULT 'pass_fail',
    "unit" TEXT,
    "lowerLimit" DOUBLE PRECISION,
    "upperLimit" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quality_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspections" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orderId" TEXT,
    "phaseId" TEXT,
    "workstationId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_results" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "quality_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_conformance_reports" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "orderId" TEXT,
    "workstationId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "description" TEXT NOT NULL,
    "defectQuantity" INTEGER NOT NULL DEFAULT 0,
    "rootCause" TEXT,
    "containmentAction" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "verifiedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "non_conformance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ncr_attachments" (
    "id" TEXT NOT NULL,
    "ncrId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ncr_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_templates" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "companyName" TEXT NOT NULL,
    "headerText" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_revisions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "changeNotes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'preventive',
    "frequencyDays" INTEGER NOT NULL,
    "frequencyHours" INTEGER,
    "estimatedMinutes" INTEGER,
    "instructions" TEXT,
    "assignedToId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "lastCompletedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "planId" TEXT,
    "type" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "partsUsed" TEXT,
    "failureCode" TEXT,
    "durationMinutes" INTEGER,
    "downtimeMinutes" INTEGER,
    "cost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cilt_checks" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" TEXT,
    "cleaningDone" BOOLEAN NOT NULL DEFAULT false,
    "cleaningNotes" TEXT,
    "inspectionDone" BOOLEAN NOT NULL DEFAULT false,
    "inspectionNotes" TEXT,
    "lubricationDone" BOOLEAN NOT NULL DEFAULT false,
    "lubricationNotes" TEXT,
    "tighteningDone" BOOLEAN NOT NULL DEFAULT false,
    "tighteningNotes" TEXT,
    "abnormalityFound" BOOLEAN NOT NULL DEFAULT false,
    "abnormalityDescription" TEXT,
    "photoUrl" TEXT,
    "maintenanceLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cilt_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "five_why_analyses" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "ncrId" TEXT,
    "incidentId" TEXT,
    "analystId" TEXT NOT NULL,
    "rootCauseSummary" TEXT,
    "categoryTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "five_why_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "five_why_steps" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "five_why_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ishikawa_analyses" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "ncrId" TEXT,
    "incidentId" TEXT,
    "analystId" TEXT NOT NULL,
    "rootCauseSummary" TEXT,
    "categoryTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ishikawa_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ishikawa_causes" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isRootCause" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ishikawa_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eight_d_reports" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ncrId" TEXT,
    "incidentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'd0_initiated',
    "teamLeaderId" TEXT NOT NULL,
    "teamMembers" TEXT,
    "d2ProblemDescription" TEXT,
    "d2IsIsNot" TEXT,
    "d3ContainmentActions" TEXT,
    "d3ContainmentEffective" BOOLEAN,
    "d4FiveWhyId" TEXT,
    "d4IshikawaId" TEXT,
    "d4RootCauseSummary" TEXT,
    "d5CorrectiveActions" TEXT,
    "d6ImplementationNotes" TEXT,
    "d7SystemicChanges" TEXT,
    "d7LessonsLearned" TEXT,
    "d8ClosedAt" TIMESTAMP(3),
    "d8CustomerResponse" TEXT,
    "categoryTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eight_d_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_incidents" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "workstationId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "outcome" TEXT NOT NULL DEFAULT 'no_injury',
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "location" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "injuredPerson" TEXT,
    "injuryType" TEXT,
    "bodyPart" TEXT,
    "treatmentGiven" TEXT,
    "daysLost" INTEGER NOT NULL DEFAULT 0,
    "potentialSeverity" TEXT,
    "isOshaRecordable" BOOLEAN NOT NULL DEFAULT false,
    "immediateAction" TEXT,
    "witnessNames" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "investigatorId" TEXT,
    "investigationDate" TIMESTAMP(3),
    "investigationNotes" TEXT,
    "fiveWhyId" TEXT,
    "ishikawaId" TEXT,
    "eightDReportId" TEXT,
    "photoUrl" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_attachments" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "corporates_slug_key" ON "corporates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sites_corporateId_slug_key" ON "sites"("corporateId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "workstations_siteId_code_key" ON "workstations"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "reason_codes_siteId_category_code_key" ON "reason_codes"("siteId", "category", "code");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_siteId_poNumber_key" ON "production_orders"("siteId", "poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_phases_orderId_sequence_key" ON "production_order_phases"("orderId", "sequence");

-- CreateIndex
CREATE INDEX "workstation_events_workstationId_timestamp_idx" ON "workstation_events"("workstationId", "timestamp");

-- CreateIndex
CREATE INDEX "five_s_audits_siteId_idx" ON "five_s_audits"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "five_s_scores_auditId_category_key" ON "five_s_scores"("auditId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_ideas_gembaObservationId_key" ON "kaizen_ideas"("gembaObservationId");

-- CreateIndex
CREATE INDEX "kaizen_ideas_siteId_idx" ON "kaizen_ideas"("siteId");

-- CreateIndex
CREATE INDEX "kaizen_ideas_status_idx" ON "kaizen_ideas"("status");

-- CreateIndex
CREATE INDEX "quality_templates_siteId_idx" ON "quality_templates"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "quality_checkpoints_templateId_sequence_key" ON "quality_checkpoints"("templateId", "sequence");

-- CreateIndex
CREATE INDEX "quality_inspections_siteId_idx" ON "quality_inspections"("siteId");

-- CreateIndex
CREATE INDEX "quality_inspections_templateId_idx" ON "quality_inspections"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "quality_results_inspectionId_checkpointId_key" ON "quality_results"("inspectionId", "checkpointId");

-- CreateIndex
CREATE INDEX "non_conformance_reports_siteId_idx" ON "non_conformance_reports"("siteId");

-- CreateIndex
CREATE INDEX "non_conformance_reports_status_idx" ON "non_conformance_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "report_templates_siteId_key" ON "report_templates"("siteId");

-- CreateIndex
CREATE INDEX "documents_siteId_idx" ON "documents"("siteId");

-- CreateIndex
CREATE INDEX "documents_category_status_idx" ON "documents"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "document_revisions_documentId_version_key" ON "document_revisions"("documentId", "version");

-- CreateIndex
CREATE INDEX "maintenance_plans_siteId_idx" ON "maintenance_plans"("siteId");

-- CreateIndex
CREATE INDEX "maintenance_plans_nextDueDate_idx" ON "maintenance_plans"("nextDueDate");

-- CreateIndex
CREATE INDEX "maintenance_logs_siteId_idx" ON "maintenance_logs"("siteId");

-- CreateIndex
CREATE INDEX "maintenance_logs_workstationId_performedAt_idx" ON "maintenance_logs"("workstationId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cilt_checks_maintenanceLogId_key" ON "cilt_checks"("maintenanceLogId");

-- CreateIndex
CREATE INDEX "cilt_checks_siteId_idx" ON "cilt_checks"("siteId");

-- CreateIndex
CREATE INDEX "cilt_checks_workstationId_date_idx" ON "cilt_checks"("workstationId", "date");

-- CreateIndex
CREATE INDEX "five_why_analyses_siteId_idx" ON "five_why_analyses"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "five_why_steps_analysisId_stepNumber_key" ON "five_why_steps"("analysisId", "stepNumber");

-- CreateIndex
CREATE INDEX "ishikawa_analyses_siteId_idx" ON "ishikawa_analyses"("siteId");

-- CreateIndex
CREATE INDEX "eight_d_reports_siteId_idx" ON "eight_d_reports"("siteId");

-- CreateIndex
CREATE INDEX "eight_d_reports_status_idx" ON "eight_d_reports"("status");

-- CreateIndex
CREATE INDEX "safety_incidents_siteId_idx" ON "safety_incidents"("siteId");

-- CreateIndex
CREATE INDEX "safety_incidents_siteId_type_date_idx" ON "safety_incidents"("siteId", "type", "date");

-- CreateIndex
CREATE INDEX "safety_incidents_severity_date_idx" ON "safety_incidents"("severity", "date");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_corporateId_fkey" FOREIGN KEY ("corporateId") REFERENCES "corporates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_corporateId_fkey" FOREIGN KEY ("corporateId") REFERENCES "corporates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstations" ADD CONSTRAINT "workstations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstations" ADD CONSTRAINT "workstations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reason_codes" ADD CONSTRAINT "reason_codes_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_definitions" ADD CONSTRAINT "shift_definitions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_phases" ADD CONSTRAINT "production_order_phases_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_phases" ADD CONSTRAINT "production_order_phases_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "production_order_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstation_events" ADD CONSTRAINT "workstation_events_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstation_events" ADD CONSTRAINT "workstation_events_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstation_events" ADD CONSTRAINT "workstation_events_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gemba_walks" ADD CONSTRAINT "gemba_walks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gemba_walks" ADD CONSTRAINT "gemba_walks_walkerId_fkey" FOREIGN KEY ("walkerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gemba_observations" ADD CONSTRAINT "gemba_observations_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "gemba_walks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gemba_observations" ADD CONSTRAINT "gemba_observations_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gemba_observations" ADD CONSTRAINT "gemba_observations_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_s_audits" ADD CONSTRAINT "five_s_audits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_s_audits" ADD CONSTRAINT "five_s_audits_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_s_scores" ADD CONSTRAINT "five_s_scores_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "five_s_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_ideas" ADD CONSTRAINT "kaizen_ideas_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_ideas" ADD CONSTRAINT "kaizen_ideas_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_ideas" ADD CONSTRAINT "kaizen_ideas_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_ideas" ADD CONSTRAINT "kaizen_ideas_gembaObservationId_fkey" FOREIGN KEY ("gembaObservationId") REFERENCES "gemba_observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_templates" ADD CONSTRAINT "quality_templates_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_templates" ADD CONSTRAINT "quality_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checkpoints" ADD CONSTRAINT "quality_checkpoints_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "quality_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "quality_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_results" ADD CONSTRAINT "quality_results_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_results" ADD CONSTRAINT "quality_results_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "quality_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncr_attachments" ADD CONSTRAINT "ncr_attachments_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "non_conformance_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cilt_checks" ADD CONSTRAINT "cilt_checks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cilt_checks" ADD CONSTRAINT "cilt_checks_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cilt_checks" ADD CONSTRAINT "cilt_checks_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cilt_checks" ADD CONSTRAINT "cilt_checks_maintenanceLogId_fkey" FOREIGN KEY ("maintenanceLogId") REFERENCES "maintenance_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_why_analyses" ADD CONSTRAINT "five_why_analyses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_why_analyses" ADD CONSTRAINT "five_why_analyses_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "five_why_steps" ADD CONSTRAINT "five_why_steps_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "five_why_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ishikawa_analyses" ADD CONSTRAINT "ishikawa_analyses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ishikawa_analyses" ADD CONSTRAINT "ishikawa_analyses_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ishikawa_causes" ADD CONSTRAINT "ishikawa_causes_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ishikawa_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eight_d_reports" ADD CONSTRAINT "eight_d_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eight_d_reports" ADD CONSTRAINT "eight_d_reports_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eight_d_reports" ADD CONSTRAINT "eight_d_reports_d4FiveWhyId_fkey" FOREIGN KEY ("d4FiveWhyId") REFERENCES "five_why_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eight_d_reports" ADD CONSTRAINT "eight_d_reports_d4IshikawaId_fkey" FOREIGN KEY ("d4IshikawaId") REFERENCES "ishikawa_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_attachments" ADD CONSTRAINT "safety_attachments_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "safety_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
