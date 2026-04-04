import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ErpService {
  private readonly logger = new Logger(ErpService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get ERP connection config for a site (masks sensitive fields)
   */
  async getConnection(siteId: string) {
    const conn = await this.prisma.erpConnection.findUnique({ where: { siteId } });
    if (!conn) return null;

    return {
      ...conn,
      apiKey: conn.apiKey ? '********' : null,
      password: conn.password ? '********' : null,
    };
  }

  /**
   * Create or update ERP connection for a site
   */
  async saveConnection(siteId: string, data: {
    provider: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    syncEnabled?: boolean;
    syncInterval?: number;
    config?: string;
  }) {
    const validProviders = ['sap', 'oracle', 'custom_api', 'csv_import'];
    if (!validProviders.includes(data.provider)) {
      throw new BadRequestException(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
    }

    if (data.syncInterval !== undefined) {
      if (data.syncInterval < 15 || data.syncInterval > 1440) {
        throw new BadRequestException('Sync interval must be between 15 and 1440 minutes');
      }
    }

    const existing = await this.prisma.erpConnection.findUnique({ where: { siteId } });

    // If updating, only overwrite apiKey/password if non-masked value provided
    const updateData: any = { ...data };
    if (existing) {
      if (updateData.apiKey === '********' || updateData.apiKey === undefined) {
        delete updateData.apiKey;
      }
      if (updateData.password === '********' || updateData.password === undefined) {
        delete updateData.password;
      }
    }

    const conn = await this.prisma.erpConnection.upsert({
      where: { siteId },
      create: { siteId, ...updateData },
      update: updateData,
    });

    return {
      ...conn,
      apiKey: conn.apiKey ? '********' : null,
      password: conn.password ? '********' : null,
    };
  }

  /**
   * Test ERP connection (mock: checks if URL is reachable for API providers)
   */
  async testConnection(siteId: string) {
    const conn = await this.prisma.erpConnection.findUnique({ where: { siteId } });
    if (!conn) throw new NotFoundException('No ERP connection configured for this site');

    if (conn.provider === 'csv_import') {
      return { success: true, message: 'CSV import does not require a connection test' };
    }

    if (!conn.baseUrl) {
      return { success: false, message: 'No base URL configured' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(conn.baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeout);

      if (res && res.ok) {
        return { success: true, message: `Connection successful (HTTP ${res.status})` };
      } else if (res) {
        return { success: true, message: `Server reachable (HTTP ${res.status}). Authentication may be needed.` };
      } else {
        return { success: false, message: 'Could not reach the server. Check the URL and network.' };
      }
    } catch (err) {
      return { success: false, message: `Connection failed: ${(err as Error).message}` };
    }
  }

  /**
   * Import production orders from ERP (simulated for SAP/Oracle/Custom, real for CSV)
   */
  async importOrders(siteId: string) {
    const conn = await this.prisma.erpConnection.findUnique({ where: { siteId } });
    if (!conn) throw new NotFoundException('No ERP connection configured');

    const log = await this.prisma.erpSyncLog.create({
      data: {
        connectionId: conn.id,
        direction: 'import',
        entityType: 'production_order',
        status: 'success',
      },
    });

    if (conn.provider === 'csv_import') {
      await this.prisma.erpSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          message: 'Use the CSV import endpoint for CSV-based providers',
          completedAt: new Date(),
        },
      });
      return { imported: 0, skipped: 0, errors: ['Use the CSV upload endpoint for CSV providers'] };
    }

    // Simulate API-based import
    this.logger.log(`[ERP Import] Would connect to ${conn.provider} at ${conn.baseUrl} for site ${siteId}`);

    // Simulated response: no real orders imported
    await this.prisma.erpSyncLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        message: `Simulated ${conn.provider} import. No real API connection made.`,
        recordCount: 0,
        completedAt: new Date(),
      },
    });

    await this.prisma.erpConnection.update({
      where: { siteId },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'success', lastSyncMessage: 'Simulated import' },
    });

    return { imported: 0, skipped: 0, errors: [], message: `Simulated ${conn.provider} import. Connect a real ERP to see orders.` };
  }

  /**
   * Import production orders from CSV data
   * CSV columns: PO Number, Product Name, Target Quantity, Unit, Due Date, Priority, Phase Name, Workstation Code, Cycle Time (s)
   */
  async importOrdersFromCsv(siteId: string, csvData: string) {
    const conn = await this.prisma.erpConnection.findUnique({ where: { siteId } });

    const log = await this.prisma.erpSyncLog.create({
      data: {
        connectionId: conn?.id || 'manual',
        direction: 'import',
        entityType: 'production_order',
        status: 'success',
      },
    });

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      await this.updateSyncLog(log.id, 'error', 'CSV file is empty or has no data rows', 0);
      throw new BadRequestException('CSV file must have a header row and at least one data row');
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const colMap = {
      poNumber: header.findIndex(h => h.includes('po number') || h === 'ponumber'),
      productName: header.findIndex(h => h.includes('product name') || h === 'productname'),
      targetQty: header.findIndex(h => h.includes('target quantity') || h === 'targetquantity'),
      unit: header.findIndex(h => h === 'unit'),
      dueDate: header.findIndex(h => h.includes('due date') || h === 'duedate'),
      priority: header.findIndex(h => h === 'priority'),
      phaseName: header.findIndex(h => h.includes('phase name') || h === 'phasename'),
      workstationCode: header.findIndex(h => h.includes('workstation code') || h === 'workstationcode'),
      cycleTime: header.findIndex(h => h.includes('cycle time') || h === 'cycletime'),
    };

    if (colMap.poNumber === -1 || colMap.productName === -1 || colMap.targetQty === -1) {
      await this.updateSyncLog(log.id, 'error', 'Missing required columns: PO Number, Product Name, Target Quantity', 0);
      throw new BadRequestException('CSV must have columns: PO Number, Product Name, Target Quantity');
    }

    // Group rows by PO Number
    const orderMap = new Map<string, { order: any; phases: any[] }>();
    const errors: string[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCsvRow(lines[i]);
      if (row.length === 0 || row.every(c => !c.trim())) continue;

      const poNumber = row[colMap.poNumber]?.trim();
      if (!poNumber) {
        errors.push(`Row ${i + 1}: Missing PO Number`);
        skipped++;
        continue;
      }

      if (!orderMap.has(poNumber)) {
        const targetQty = parseInt(row[colMap.targetQty]?.trim() || '0', 10);
        if (isNaN(targetQty) || targetQty <= 0) {
          errors.push(`Row ${i + 1}: Invalid target quantity for ${poNumber}`);
          skipped++;
          continue;
        }

        let dueDate: Date | null = null;
        if (colMap.dueDate !== -1 && row[colMap.dueDate]?.trim()) {
          dueDate = new Date(row[colMap.dueDate].trim());
          if (isNaN(dueDate.getTime())) dueDate = null;
        }

        orderMap.set(poNumber, {
          order: {
            poNumber,
            productName: row[colMap.productName]?.trim() || 'Unknown',
            targetQuantity: targetQty,
            unit: colMap.unit !== -1 ? row[colMap.unit]?.trim() || 'pcs' : 'pcs',
            dueDate,
            priority: colMap.priority !== -1 ? row[colMap.priority]?.trim() || 'normal' : 'normal',
          },
          phases: [],
        });
      }

      // Add phase if phase name provided
      if (colMap.phaseName !== -1 && row[colMap.phaseName]?.trim()) {
        orderMap.get(poNumber)!.phases.push({
          name: row[colMap.phaseName].trim(),
          workstationCode: colMap.workstationCode !== -1 ? row[colMap.workstationCode]?.trim() : null,
          cycleTimeSeconds: colMap.cycleTime !== -1 ? parseInt(row[colMap.cycleTime]?.trim() || '0', 10) : 60,
        });
      }
    }

    // Preload workstations for the site
    const workstations = await this.prisma.workstation.findMany({
      where: { siteId, isActive: true },
      select: { id: true, code: true, name: true },
    });
    const wsMap = new Map(workstations.map(w => [w.code.toLowerCase(), w.id]));
    // Fallback: first workstation
    const defaultWsId = workstations[0]?.id;

    let imported = 0;

    for (const [poNumber, entry] of orderMap) {
      try {
        // Check if order already exists
        const existing = await this.prisma.productionOrder.findUnique({
          where: { siteId_poNumber: { siteId, poNumber } },
        });
        if (existing) {
          errors.push(`${poNumber}: Already exists, skipped`);
          skipped++;
          continue;
        }

        const validPriorities = ['normal', 'high', 'urgent'];
        const priority = validPriorities.includes(entry.order.priority) ? entry.order.priority : 'normal';

        // Create the production order with phases
        await this.prisma.productionOrder.create({
          data: {
            siteId,
            poNumber: entry.order.poNumber,
            productName: entry.order.productName,
            targetQuantity: entry.order.targetQuantity,
            unit: entry.order.unit,
            dueDate: entry.order.dueDate,
            priority,
            source: 'erp',
            status: 'released',
            phases: entry.phases.length > 0 ? {
              create: entry.phases.map((ph: any, idx: number) => {
                const wsId = ph.workstationCode
                  ? wsMap.get(ph.workstationCode.toLowerCase()) || defaultWsId
                  : defaultWsId;

                if (!wsId) {
                  throw new Error(`No workstation found for code "${ph.workstationCode}" and no default available`);
                }

                return {
                  sequence: (idx + 1) * 10,
                  name: ph.name,
                  workstationId: wsId,
                  cycleTimeSeconds: ph.cycleTimeSeconds || 60,
                };
              }),
            } : undefined,
          },
        });
        imported++;
      } catch (err) {
        errors.push(`${poNumber}: ${(err as Error).message}`);
        skipped++;
      }
    }

    const status = errors.length > 0 ? (imported > 0 ? 'partial' : 'error') : 'success';
    await this.updateSyncLog(log.id, status, `Imported ${imported}, skipped ${skipped}`, imported);

    if (conn) {
      await this.prisma.erpConnection.update({
        where: { siteId },
        data: { lastSyncAt: new Date(), lastSyncStatus: status, lastSyncMessage: `CSV: ${imported} imported, ${skipped} skipped` },
      });
    }

    return { imported, skipped, errors };
  }

  /**
   * Export completed production results
   */
  async exportResults(siteId: string) {
    const conn = await this.prisma.erpConnection.findUnique({ where: { siteId } });

    const sinceDate = conn?.lastSyncAt || new Date(0);

    // Find completed production runs since last sync
    const runs = await this.prisma.productionRun.findMany({
      where: {
        status: 'completed',
        workstation: { siteId },
        endedAt: { gte: sinceDate },
      },
      include: {
        phase: {
          include: {
            order: { select: { poNumber: true, productName: true, targetQuantity: true } },
          },
        },
        workstation: { select: { name: true, code: true } },
        operator: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { endedAt: 'desc' },
    });

    const data = runs.map(run => ({
      poNumber: run.phase.order.poNumber,
      productName: run.phase.order.productName,
      phaseName: run.phase.name,
      workstation: run.workstation.code || run.workstation.name,
      operator: `${run.operator.firstName} ${run.operator.lastName}`,
      producedQuantity: run.producedQuantity,
      scrapQuantity: run.scrapQuantity,
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() || null,
      shiftDate: run.shiftDate,
    }));

    // Log the export
    if (conn) {
      await this.prisma.erpSyncLog.create({
        data: {
          connectionId: conn.id,
          direction: 'export',
          entityType: 'production_result',
          recordCount: data.length,
          status: 'success',
          message: `Exported ${data.length} completed production runs`,
          details: JSON.stringify({ count: data.length }),
          completedAt: new Date(),
        },
      });

      if (conn.provider !== 'csv_import') {
        this.logger.log(`[ERP Export] Would push ${data.length} records to ${conn.provider} at ${conn.baseUrl}`);
      }

      await this.prisma.erpConnection.update({
        where: { siteId },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'success', lastSyncMessage: `Exported ${data.length} results` },
      });
    }

    return { exported: data.length, data };
  }

  /**
   * Generate CSV string from export results
   */
  async exportResultsCsv(siteId: string): Promise<string> {
    const { data } = await this.exportResults(siteId);

    const header = 'PO Number,Product Name,Phase,Workstation,Operator,Produced,Scrap,Started At,Ended At,Shift Date';
    const rows = data.map(r =>
      [r.poNumber, r.productName, r.phaseName, r.workstation, r.operator,
       r.producedQuantity, r.scrapQuantity, r.startedAt, r.endedAt || '', r.shiftDate]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Get paginated sync logs for a site
   */
  async getSyncLogs(siteId: string, limit = 20) {
    const conn = await this.prisma.erpConnection.findUnique({ where: { siteId } });
    if (!conn) return { data: [], total: 0 };

    const take = Math.min(Math.max(1, limit), 100);

    const [data, total] = await Promise.all([
      this.prisma.erpSyncLog.findMany({
        where: { connectionId: conn.id },
        orderBy: { startedAt: 'desc' },
        take,
      }),
      this.prisma.erpSyncLog.count({ where: { connectionId: conn.id } }),
    ]);

    return { data, total };
  }

  // ── Helpers ──────────────────────────────────────────

  private async updateSyncLog(id: string, status: string, message: string, recordCount: number) {
    await this.prisma.erpSyncLog.update({
      where: { id },
      data: { status, message, recordCount, completedAt: new Date() },
    });
  }

  /**
   * Simple CSV row parser that handles quoted fields
   */
  private parseCsvRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  }
}
