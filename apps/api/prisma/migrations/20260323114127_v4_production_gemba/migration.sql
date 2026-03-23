/*
  Warnings:

  - You are about to drop the `five_s_audits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `five_s_scores` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kaizen_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "five_s_audits";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "five_s_scores";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "kaizen_items";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "workstations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'machine',
    "area" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workstations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reason_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#gray',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "reason_codes_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shift_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "days" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "shift_definitions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'released',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "production_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_order_phases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "cycleTimeSeconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "production_order_phases_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "production_order_phases_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "shiftDate" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "producedQuantity" INTEGER NOT NULL DEFAULT 0,
    "scrapQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "production_runs_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "production_order_phases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "production_runs_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_runs_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workstation_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workstationId" TEXT NOT NULL,
    "productionRunId" TEXT,
    "operatorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT,
    "reasonCode" TEXT,
    "notes" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workstation_events_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workstation_events_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workstation_events_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gemba_walks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "walkerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    CONSTRAINT "gemba_walks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gemba_walks_walkerId_fkey" FOREIGN KEY ("walkerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gemba_observations" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gemba_observations_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "gemba_walks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gemba_observations_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "workstations_siteId_code_key" ON "workstations"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "reason_codes_siteId_category_code_key" ON "reason_codes"("siteId", "category", "code");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_siteId_poNumber_key" ON "production_orders"("siteId", "poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_phases_orderId_sequence_key" ON "production_order_phases"("orderId", "sequence");
