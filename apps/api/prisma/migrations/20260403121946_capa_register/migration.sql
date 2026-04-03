-- CreateTable
CREATE TABLE "corrective_actions_capa" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "capaNumber" TEXT NOT NULL,
    "ncrId" TEXT,
    "incidentId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "rootCause" TEXT,
    "actionTaken" TEXT,
    "implementedAt" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "verificationDate" TIMESTAMP(3),
    "verifiedById" TEXT,
    "effectivenessCheck" TEXT,
    "effectivenessDate" TIMESTAMP(3),
    "effectiveResult" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrective_actions_capa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "corrective_actions_capa_siteId_status_idx" ON "corrective_actions_capa"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "corrective_actions_capa_siteId_capaNumber_key" ON "corrective_actions_capa"("siteId", "capaNumber");

-- AddForeignKey
ALTER TABLE "corrective_actions_capa" ADD CONSTRAINT "corrective_actions_capa_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions_capa" ADD CONSTRAINT "corrective_actions_capa_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "non_conformance_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions_capa" ADD CONSTRAINT "corrective_actions_capa_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions_capa" ADD CONSTRAINT "corrective_actions_capa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions_capa" ADD CONSTRAINT "corrective_actions_capa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
