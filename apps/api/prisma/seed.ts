// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Permission Templates ──────────────────────────────────────────

const FEATURE_GROUPS = [
  'production', 'shift_management', 'continuous_improvement',
  'quality', 'problem_solving', 'safety', 'maintenance', 'people',
];

type PermMap = Record<string, string>;

const ROLE_TEMPLATES: Record<string, { description: string; permissions: PermMap }> = {
  'Shop Floor Operator': {
    description: 'Tablet-only production operator — shop floor and safety reporting',
    permissions: {
      production: 'participate',
      safety: 'participate',
    },
  },
  'Shift Leader': {
    description: 'Line/shift supervisor — daily operations, shift handover, basic CI',
    permissions: {
      production: 'participate',
      shift_management: 'manage',
      continuous_improvement: 'participate',
      quality: 'view',
      problem_solving: 'view',
      safety: 'participate',
      maintenance: 'view',
      people: 'view',
    },
  },
  'Operator': {
    description: 'Production worker — 5S, Kaizen, CILT, safety reporting',
    permissions: {
      production: 'participate',
      shift_management: 'view',
      continuous_improvement: 'participate',
      quality: 'view',
      safety: 'participate',
      maintenance: 'participate',
    },
  },
  'Quality Engineer': {
    description: 'Quality technician — inspections, NCR, root cause, documents',
    permissions: {
      continuous_improvement: 'participate',
      quality: 'manage',
      problem_solving: 'manage',
      safety: 'participate',
    },
  },
  'Lean Coordinator': {
    description: 'CI manager — all lean tools, problem solving, maintenance planning',
    permissions: {
      production: 'view',
      shift_management: 'manage',
      continuous_improvement: 'manage',
      quality: 'manage',
      problem_solving: 'manage',
      safety: 'manage',
      maintenance: 'manage',
      people: 'view',
    },
  },
  'Full Access': {
    description: 'All permissions — equivalent to site-level manager',
    permissions: {
      production: 'manage',
      shift_management: 'manage',
      continuous_improvement: 'manage',
      quality: 'manage',
      problem_solving: 'manage',
      safety: 'manage',
      maintenance: 'manage',
      people: 'manage',
    },
  },
};

async function main() {
  console.log('Seeding database...');

  // 1. Corporate
  const corporate = await prisma.corporate.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: { name: 'Demo Manufacturing Group', slug: 'demo-corp' },
  });

  // 2. Sites
  const milan = await prisma.site.upsert({
    where: { corporateId_slug: { corporateId: corporate.id, slug: 'milan-factory' } },
    update: {},
    create: {
      name: 'Milan Factory', slug: 'milan-factory',
      location: 'Milan, Italy', timezone: 'Europe/Rome',
      corporateId: corporate.id,
    },
  });

  const belgrade = await prisma.site.upsert({
    where: { corporateId_slug: { corporateId: corporate.id, slug: 'belgrade-plant' } },
    update: {},
    create: {
      name: 'Belgrade Plant', slug: 'belgrade-plant',
      location: 'Belgrade, Serbia', timezone: 'Europe/Belgrade',
      corporateId: corporate.id,
    },
  });

  // 3. Seed Role Templates (per site)
  console.log('Creating role templates...');
  const roleMap: Record<string, Record<string, string>> = {};

  for (const site of [milan, belgrade]) {
    roleMap[site.id] = {};
    for (const [name, tmpl] of Object.entries(ROLE_TEMPLATES)) {
      const existing = await prisma.customRole.findUnique({
        where: { siteId_name: { siteId: site.id, name } },
      });

      let role;
      if (existing) {
        role = existing;
      } else {
        role = await prisma.customRole.create({
          data: {
            siteId: site.id,
            name,
            description: tmpl.description,
            isSystem: false,
            isDefault: true,
          },
        });

        const permData = FEATURE_GROUPS.map(group => ({
          roleId: role.id,
          featureGroup: group,
          level: tmpl.permissions[group] || 'none',
        }));
        await prisma.rolePermission.createMany({ data: permData });
      }

      roleMap[site.id][name] = role.id;
    }
  }

  // System "Viewer" role (no site, shared)
  let viewerRole = await prisma.customRole.findFirst({
    where: { name: 'Viewer', isSystem: true },
  });
  if (!viewerRole) {
    viewerRole = await prisma.customRole.create({
      data: { name: 'Viewer', description: 'Read-only access to dashboards and reports', isSystem: true, isDefault: true },
    });
    const viewerPerms = FEATURE_GROUPS.map(group => ({
      roleId: viewerRole.id,
      featureGroup: group,
      level: group === 'safety' ? 'participate' : 'view',
    }));
    await prisma.rolePermission.createMany({ data: viewerPerms });
  }

  // 4. Users
  const pw = await bcrypt.hash('password123', 12);

  async function upsertUser(data: any, customRoleId?: string) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      if (customRoleId && !existing.customRoleId) {
        await prisma.user.update({ where: { id: existing.id }, data: { customRoleId, role: 'custom' } });
      }
      return existing;
    }
    return prisma.user.create({
      data: { ...data, password: pw, corporateId: corporate.id, customRoleId },
    });
  }

  // System admin users (bypass permission checks)
  await upsertUser({ email: 'admin@leanpilot.me', firstName: 'Alberto', lastName: 'Grassi', role: 'corporate_admin', siteId: milan.id });
  await upsertUser({ email: 'site.admin@leanpilot.me', firstName: 'Marco', lastName: 'Rossi', role: 'site_admin', siteId: milan.id });
  await upsertUser({ email: 'belgrade.admin@leanpilot.me', firstName: 'Nikola', lastName: 'Jovanovic', role: 'site_admin', siteId: belgrade.id });

  // Viewer (system role + viewer custom role for permissions)
  await upsertUser({ email: 'viewer@leanpilot.me', firstName: 'Anna', lastName: 'Ferrari', role: 'viewer', siteId: milan.id }, viewerRole.id);

  // Custom role users
  await upsertUser({ email: 'manager@leanpilot.me', firstName: 'Luca', lastName: 'Bianchi', role: 'custom', siteId: milan.id }, roleMap[milan.id]['Full Access']);
  await upsertUser({ email: 'operator1@leanpilot.me', firstName: 'Giuseppe', lastName: 'Verdi', role: 'custom', siteId: milan.id }, roleMap[milan.id]['Operator']);
  await upsertUser({ email: 'operator2@leanpilot.me', firstName: 'Paolo', lastName: 'Neri', role: 'custom', siteId: milan.id }, roleMap[milan.id]['Operator']);
  await upsertUser({ email: 'floor@leanpilot.me', firstName: 'Roberto', lastName: 'Colombo', role: 'custom', siteId: milan.id }, roleMap[milan.id]['Shop Floor Operator']);
  await upsertUser({ email: 'shift.leader@leanpilot.me', firstName: 'Davide', lastName: 'Ricci', role: 'custom', siteId: milan.id }, roleMap[milan.id]['Shift Leader']);
  await upsertUser({ email: 'quality@leanpilot.me', firstName: 'Elena', lastName: 'Romano', role: 'custom', siteId: milan.id }, roleMap[milan.id]['Quality Engineer']);
  await upsertUser({ email: 'lean@leanpilot.me', firstName: 'Sergio', lastName: 'Martini', role: 'custom', siteId: milan.id }, roleMap[milan.id]['Lean Coordinator']);
  await upsertUser({ email: 'belgrade.operator@leanpilot.me', firstName: 'Milan', lastName: 'Petrovic', role: 'custom', siteId: belgrade.id }, roleMap[belgrade.id]['Operator']);

  // 5. Workstations (Milan)
  const workstations = [
    { name: 'CNC Lathe 1', type: 'machine', area: 'Machining', code: 'CNC-01' },
    { name: 'CNC Mill 2', type: 'machine', area: 'Machining', code: 'CNC-02' },
    { name: 'Press Brake', type: 'machine', area: 'Forming', code: 'PB-01' },
    { name: 'Welding Station', type: 'manual', area: 'Assembly', code: 'WLD-01' },
    { name: 'Assembly Line 1', type: 'line', area: 'Assembly', code: 'ASM-01' },
    { name: 'Paint Booth', type: 'machine', area: 'Finishing', code: 'PNT-01' },
  ];

  const ws: Record<string, any> = {};
  for (const w of workstations) {
    ws[w.code] = await prisma.workstation.upsert({
      where: { siteId_code: { siteId: milan.id, code: w.code } },
      update: {},
      create: { ...w, siteId: milan.id },
    });
  }

  // 6. Shift Definitions
  const shiftDefs = [
    { siteId: milan.id, name: 'Morning', startTime: '06:00', endTime: '14:00', days: '["mon","tue","wed","thu","fri"]' },
    { siteId: milan.id, name: 'Afternoon', startTime: '14:00', endTime: '22:00', days: '["mon","tue","wed","thu","fri"]' },
    { siteId: milan.id, name: 'Night', startTime: '22:00', endTime: '06:00', days: '["mon","tue","wed","thu","fri"]' },
  ];
  for (const s of shiftDefs) {
    await prisma.shiftDefinition.create({ data: s }).catch(() => {});
  }

  // 7. Reason Codes
  const reasons = [
    { category: 'breakdown', code: 'MECH', label: 'Mechanical failure' },
    { category: 'breakdown', code: 'ELEC', label: 'Electrical failure' },
    { category: 'breakdown', code: 'PNEU', label: 'Pneumatic/hydraulic' },
    { category: 'breakdown', code: 'TOOL', label: 'Tool breakage' },
    { category: 'breakdown', code: 'SOFT', label: 'Software/program error' },
    { category: 'breakdown', code: 'OTHR', label: 'Other' },
    { category: 'changeover', code: 'FMT', label: 'Format change' },
    { category: 'changeover', code: 'MAT', label: 'Material change' },
    { category: 'changeover', code: 'TOOL', label: 'Tool change' },
    { category: 'quality', code: 'DIM', label: 'Dimensional issue' },
    { category: 'quality', code: 'VIS', label: 'Visual defect' },
    { category: 'quality', code: 'FUNC', label: 'Functional issue' },
    { category: 'quality', code: 'MATL', label: 'Material defect' },
    { category: 'idle', code: 'WAIT', label: 'Waiting for material' },
    { category: 'idle', code: 'INST', label: 'Waiting for instructions' },
    { category: 'idle', code: 'OPER', label: 'No operator available' },
    { category: 'planned_stop', code: 'BRK', label: 'Break' },
    { category: 'planned_stop', code: 'MTG', label: 'Meeting' },
    { category: 'planned_stop', code: 'NORD', label: 'No orders' },
  ];

  for (const r of reasons) {
    await prisma.reasonCode.upsert({
      where: { siteId_category_code: { siteId: milan.id, category: r.category, code: r.code } },
      update: {},
      create: { ...r, siteId: milan.id },
    });
  }

  // 8. Production Orders
  const po1 = await prisma.productionOrder.upsert({
    where: { siteId_poNumber: { siteId: milan.id, poNumber: 'PO-2026-001' } },
    update: {},
    create: {
      siteId: milan.id, poNumber: 'PO-2026-001',
      productName: 'Bracket Assembly XR-200',
      targetQuantity: 1000, unit: 'pcs',
      dueDate: new Date('2026-03-28'), priority: 'high', status: 'released',
    },
  });

  await prisma.productionOrderPhase.createMany({
    data: [
      { orderId: po1.id, sequence: 10, name: 'Turning', workstationId: ws['CNC-01'].id, cycleTimeSeconds: 45 },
      { orderId: po1.id, sequence: 20, name: 'Milling', workstationId: ws['CNC-02'].id, cycleTimeSeconds: 60 },
      { orderId: po1.id, sequence: 30, name: 'Welding', workstationId: ws['WLD-01'].id, cycleTimeSeconds: 120 },
      { orderId: po1.id, sequence: 40, name: 'Painting', workstationId: ws['PNT-01'].id, cycleTimeSeconds: 30 },
    ],
  }).catch(() => {});

  const po2 = await prisma.productionOrder.upsert({
    where: { siteId_poNumber: { siteId: milan.id, poNumber: 'PO-2026-002' } },
    update: {},
    create: {
      siteId: milan.id, poNumber: 'PO-2026-002',
      productName: 'Shaft S-150',
      targetQuantity: 500, unit: 'pcs',
      dueDate: new Date('2026-03-30'), priority: 'normal', status: 'released',
    },
  });

  await prisma.productionOrderPhase.createMany({
    data: [
      { orderId: po2.id, sequence: 10, name: 'Turning', workstationId: ws['CNC-01'].id, cycleTimeSeconds: 90 },
      { orderId: po2.id, sequence: 20, name: 'Bending', workstationId: ws['PB-01'].id, cycleTimeSeconds: 35 },
    ],
  }).catch(() => {});

  const po3 = await prisma.productionOrder.upsert({
    where: { siteId_poNumber: { siteId: milan.id, poNumber: 'PO-2026-003' } },
    update: {},
    create: {
      siteId: milan.id, poNumber: 'PO-2026-003',
      productName: 'Housing Unit H-400',
      targetQuantity: 200, unit: 'pcs',
      dueDate: new Date('2026-04-05'), priority: 'normal', status: 'released',
    },
  });

  await prisma.productionOrderPhase.createMany({
    data: [
      { orderId: po3.id, sequence: 10, name: 'Milling', workstationId: ws['CNC-02'].id, cycleTimeSeconds: 180 },
      { orderId: po3.id, sequence: 20, name: 'Assembly', workstationId: ws['ASM-01'].id, cycleTimeSeconds: 240 },
      { orderId: po3.id, sequence: 30, name: 'Painting', workstationId: ws['PNT-01'].id, cycleTimeSeconds: 45 },
    ],
  }).catch(() => {});

  // 9. Escalation Rules (Milan)
  const escalationRules = [
    { name: 'Breakdown L1 — Shift Leader', triggerType: 'breakdown', conditionMinutes: 10, notifyGroup: 'shift_management', notifyLevel: 'manage', escalationTier: 1 },
    { name: 'Breakdown L2 — Maintenance', triggerType: 'breakdown', conditionMinutes: 30, notifyGroup: 'maintenance', notifyLevel: 'manage', escalationTier: 2 },
    { name: 'Breakdown L3 — Plant Manager', triggerType: 'breakdown', conditionMinutes: 60, notifyGroup: 'people', notifyLevel: 'manage', escalationTier: 3 },
    { name: 'Safety Critical — Immediate', triggerType: 'safety_incident', conditionMinutes: 0, notifyGroup: 'safety', notifyLevel: 'manage', escalationTier: 1 },
    { name: 'NCR Critical — Immediate', triggerType: 'ncr_critical', conditionMinutes: 0, notifyGroup: 'quality', notifyLevel: 'manage', escalationTier: 1 },
    { name: 'Action Overdue — 24h', triggerType: 'action_overdue', conditionMinutes: 1440, notifyGroup: 'continuous_improvement', notifyLevel: 'manage', escalationTier: 1 },
  ];
  for (const rule of escalationRules) {
    await prisma.escalationRule.upsert({
      where: { siteId_name: { siteId: milan.id, name: rule.name } },
      update: {},
      create: { ...rule, siteId: milan.id },
    });
  }

  // ── Fetch user references for demo data ──────────────────────────
  const userAdmin = await prisma.user.findUnique({ where: { email: 'admin@leanpilot.me' } });
  const userManager = await prisma.user.findUnique({ where: { email: 'manager@leanpilot.me' } });
  const userOp1 = await prisma.user.findUnique({ where: { email: 'operator1@leanpilot.me' } });
  const userOp2 = await prisma.user.findUnique({ where: { email: 'operator2@leanpilot.me' } });
  const userQuality = await prisma.user.findUnique({ where: { email: 'quality@leanpilot.me' } });
  const userShift = await prisma.user.findUnique({ where: { email: 'shift.leader@leanpilot.me' } });
  const userLean = await prisma.user.findUnique({ where: { email: 'lean@leanpilot.me' } });

  // Helper: date N days ago at a specific hour
  const daysAgo = (days: number, hour = 6) => {
    const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  // ── 10. Production Runs (completed, for OEE data) ─────────────────
  console.log('Creating production runs...');

  // Fetch phases for the existing POs
  const po1Phases = await prisma.productionOrderPhase.findMany({ where: { orderId: po1.id }, orderBy: { sequence: 'asc' } });
  const po2Phases = await prisma.productionOrderPhase.findMany({ where: { orderId: po2.id }, orderBy: { sequence: 'asc' } });
  const po3Phases = await prisma.productionOrderPhase.findMany({ where: { orderId: po3.id }, orderBy: { sequence: 'asc' } });

  const runConfigs = [
    // PO1 — Bracket Assembly XR-200
    { phase: po1Phases[0], wsCode: 'CNC-01', op: userOp1!, day: 6, startH: 6, endH: 14, produced: 180, scrap: 6 },
    { phase: po1Phases[0], wsCode: 'CNC-01', op: userOp2!, day: 5, startH: 6, endH: 14, produced: 195, scrap: 4 },
    { phase: po1Phases[0], wsCode: 'CNC-01', op: userOp1!, day: 4, startH: 6, endH: 14, produced: 170, scrap: 8 },
    { phase: po1Phases[1], wsCode: 'CNC-02', op: userOp2!, day: 5, startH: 14, endH: 22, produced: 160, scrap: 5 },
    { phase: po1Phases[1], wsCode: 'CNC-02', op: userOp1!, day: 4, startH: 14, endH: 22, produced: 175, scrap: 7 },
    { phase: po1Phases[2], wsCode: 'WLD-01', op: userOp2!, day: 3, startH: 6, endH: 14, produced: 140, scrap: 3 },
    { phase: po1Phases[3], wsCode: 'PNT-01', op: userOp1!, day: 2, startH: 6, endH: 14, produced: 280, scrap: 4 },
    // PO2 — Shaft S-150
    { phase: po2Phases[0], wsCode: 'CNC-01', op: userOp2!, day: 3, startH: 14, endH: 22, produced: 85, scrap: 3 },
    { phase: po2Phases[0], wsCode: 'CNC-01', op: userOp1!, day: 2, startH: 14, endH: 22, produced: 90, scrap: 2 },
    { phase: po2Phases[1], wsCode: 'PB-01', op: userOp2!, day: 1, startH: 6, endH: 14, produced: 160, scrap: 5 },
    // PO3 — Housing Unit H-400
    { phase: po3Phases[0], wsCode: 'CNC-02', op: userOp1!, day: 3, startH: 6, endH: 14, produced: 42, scrap: 2 },
    { phase: po3Phases[1], wsCode: 'ASM-01', op: userOp2!, day: 2, startH: 14, endH: 22, produced: 35, scrap: 1 },
    { phase: po3Phases[2], wsCode: 'PNT-01', op: userOp1!, day: 1, startH: 14, endH: 22, produced: 65, scrap: 2 },
  ];

  for (const rc of runConfigs) {
    const startedAt = daysAgo(rc.day, rc.startH);
    const endedAt = daysAgo(rc.day, rc.endH);
    const shiftDate = startedAt.toISOString().slice(0, 10);

    const run = await prisma.productionRun.create({
      data: {
        phaseId: rc.phase.id,
        workstationId: ws[rc.wsCode].id,
        operatorId: rc.op.id,
        shiftDate,
        startedAt,
        endedAt,
        producedQuantity: rc.produced,
        scrapQuantity: rc.scrap,
        status: 'completed',
      },
    }).catch(() => null);

    if (run) {
      // po_start event
      await prisma.workstationEvent.create({
        data: {
          workstationId: ws[rc.wsCode].id,
          productionRunId: run.id,
          operatorId: rc.op.id,
          eventType: 'po_start',
          timestamp: startedAt,
        },
      }).catch(() => {});

      // running status
      await prisma.workstationEvent.create({
        data: {
          workstationId: ws[rc.wsCode].id,
          productionRunId: run.id,
          operatorId: rc.op.id,
          eventType: 'status_change',
          status: 'running',
          timestamp: new Date(startedAt.getTime() + 1 * 60 * 1000),
        },
      }).catch(() => {});

      // po_end event
      await prisma.workstationEvent.create({
        data: {
          workstationId: ws[rc.wsCode].id,
          productionRunId: run.id,
          operatorId: rc.op.id,
          eventType: 'po_end',
          timestamp: endedAt,
        },
      }).catch(() => {});
    }
  }

  // Add a few breakdown events for OEE availability losses
  const breakdownEvents = [
    { wsCode: 'CNC-01', day: 5, startH: 9, durationMin: 45, op: userOp2!, reason: 'MECH', notes: 'Spindle bearing overheating' },
    { wsCode: 'CNC-02', day: 4, startH: 16, durationMin: 30, op: userOp1!, reason: 'TOOL', notes: 'End mill breakage during roughing' },
    { wsCode: 'PNT-01', day: 2, startH: 10, durationMin: 55, op: userOp1!, reason: 'PNEU', notes: 'Spray nozzle clog — replaced' },
  ];

  for (const bd of breakdownEvents) {
    const bdStart = daysAgo(bd.day, bd.startH);
    const bdEnd = new Date(bdStart.getTime() + bd.durationMin * 60 * 1000);

    await prisma.workstationEvent.create({
      data: {
        workstationId: ws[bd.wsCode].id,
        operatorId: bd.op.id,
        eventType: 'status_change',
        status: 'breakdown',
        reasonCode: bd.reason,
        notes: bd.notes,
        timestamp: bdStart,
      },
    }).catch(() => {});

    await prisma.workstationEvent.create({
      data: {
        workstationId: ws[bd.wsCode].id,
        operatorId: bd.op.id,
        eventType: 'status_change',
        status: 'running',
        notes: 'Resumed after repair',
        timestamp: bdEnd,
      },
    }).catch(() => {});
  }

  // ── 11. 5S Audits (3 completed) ──────────────────────────────────
  console.log('Creating 5S audits...');

  const fiveSConfigs = [
    { area: 'Machining', auditor: userLean!, day: 5, scores: { sort: 4, set_in_order: 3, shine: 4, standardize: 3, sustain: 2, safety: 4 } },
    { area: 'Assembly', auditor: userLean!, day: 3, scores: { sort: 5, set_in_order: 4, shine: 3, standardize: 4, sustain: 3, safety: 5 } },
    { area: 'Finishing', auditor: userShift!, day: 1, scores: { sort: 3, set_in_order: 3, shine: 2, standardize: 2, sustain: 2, safety: 3 } },
  ];

  for (const cfg of fiveSConfigs) {
    const scores = cfg.scores;
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const maxScore = 30;
    const percentage = Math.round((totalScore / maxScore) * 100);

    const audit = await prisma.fiveSAudit.create({
      data: {
        siteId: milan.id,
        area: cfg.area,
        auditorId: cfg.auditor.id,
        status: 'completed',
        totalScore,
        maxScore,
        percentage,
        completedAt: daysAgo(cfg.day, 10),
        createdAt: daysAgo(cfg.day, 9),
      },
    }).catch(() => null);

    if (audit) {
      for (const [category, score] of Object.entries(scores)) {
        await prisma.fiveSScore.create({
          data: { auditId: audit.id, category, score },
        }).catch(() => {});
      }
    }
  }

  // ── 12. Safety Incidents ──────────────────────────────────────────
  console.log('Creating safety incidents...');

  const safetyIncidents = [
    {
      siteId: milan.id,
      reporterId: userOp1!.id,
      type: 'near_miss',
      severity: 'moderate',
      outcome: 'no_injury',
      date: daysAgo(2),
      time: '10:15',
      location: 'Main aisle, Bay 3',
      title: 'Forklift near-miss in aisle 3',
      description: 'Forklift turning corner nearly struck operator walking from CNC area. No horn sounded. Mirrors obstructed by stacked pallets.',
      potentialSeverity: 'serious',
      immediateAction: 'Pallets relocated. Driver briefed on horn protocol.',
      status: 'closed',
    },
    {
      siteId: milan.id,
      reporterId: userOp2!.id,
      type: 'first_aid',
      severity: 'minor',
      outcome: 'first_aid',
      date: daysAgo(5),
      time: '14:45',
      location: 'Machining area, CNC-02',
      title: 'Minor cut during deburring',
      description: 'Operator sustained a small laceration on left index finger while deburring parts. First aid kit used on site.',
      injuredPerson: 'Paolo Neri',
      injuryType: 'laceration',
      bodyPart: 'hand',
      treatmentGiven: 'Cleaned wound, applied butterfly strip and bandage',
      status: 'closed',
    },
    {
      siteId: milan.id,
      reporterId: userShift!.id,
      type: 'near_miss',
      severity: 'moderate',
      outcome: 'no_injury',
      date: daysAgo(1),
      time: '07:30',
      location: 'Machining area, CNC-01',
      title: 'Oil spill near CNC-01',
      description: 'Hydraulic oil leak from CNC-01 created slippery surface approx 2m². Discovered during morning walkthrough.',
      potentialSeverity: 'serious',
      immediateAction: 'Area cordoned off, absorbent granules applied. Maintenance called.',
      investigatorId: userShift!.id,
      status: 'investigating',
    },
  ];

  for (const inc of safetyIncidents) {
    await prisma.safetyIncident.create({ data: inc }).catch(() => {});
  }

  // ── 13. Quality — Template, Inspections, NCRs, CAPA ──────────────
  console.log('Creating quality data...');

  // Quality template with 3 checkpoints
  const qualityTemplate = await prisma.qualityTemplate.create({
    data: {
      siteId: milan.id,
      name: 'Bracket XR-200 Final Inspection',
      productName: 'Bracket Assembly XR-200',
      phase: 'Final',
      createdById: userQuality!.id,
      checkpoints: {
        create: [
          { sequence: 1, description: 'Dimensional check — bore diameter 25±0.05 mm', measurementType: 'measurement', unit: 'mm', targetValue: 25, lowerLimit: 24.95, upperLimit: 25.05 },
          { sequence: 2, description: 'Weld penetration visual inspection', measurementType: 'visual' },
          { sequence: 3, description: 'Surface finish Ra ≤ 1.6 µm', measurementType: 'measurement', unit: 'µm', targetValue: 1.6, lowerLimit: 0, upperLimit: 1.6 },
        ],
      },
    },
  }).catch(() => null);

  if (qualityTemplate) {
    const checkpoints = await prisma.qualityCheckpoint.findMany({ where: { templateId: qualityTemplate.id }, orderBy: { sequence: 'asc' } });

    // Inspection 1 — passed
    const insp1 = await prisma.qualityInspection.create({
      data: {
        siteId: milan.id,
        templateId: qualityTemplate.id,
        workstationId: ws['CNC-01'].id,
        inspectorId: userQuality!.id,
        status: 'passed',
        completedAt: daysAgo(4, 11),
        createdAt: daysAgo(4, 10),
        notes: 'All dimensions within spec. Good surface finish.',
      },
    }).catch(() => null);

    if (insp1) {
      await prisma.qualityResult.createMany({
        data: [
          { inspectionId: insp1.id, checkpointId: checkpoints[0].id, value: '25.02', passed: true },
          { inspectionId: insp1.id, checkpointId: checkpoints[1].id, value: 'pass', passed: true, notes: 'Full penetration confirmed' },
          { inspectionId: insp1.id, checkpointId: checkpoints[2].id, value: '1.2', passed: true },
        ],
      }).catch(() => {});
    }

    // Inspection 2 — failed
    const insp2 = await prisma.qualityInspection.create({
      data: {
        siteId: milan.id,
        templateId: qualityTemplate.id,
        workstationId: ws['CNC-01'].id,
        inspectorId: userQuality!.id,
        status: 'failed',
        completedAt: daysAgo(2, 15),
        createdAt: daysAgo(2, 14),
        notes: 'Bore diameter out of spec on 3 of 10 samples.',
      },
    }).catch(() => null);

    if (insp2) {
      await prisma.qualityResult.createMany({
        data: [
          { inspectionId: insp2.id, checkpointId: checkpoints[0].id, value: '25.08', passed: false, notes: 'Out of upper limit on 3/10 samples' },
          { inspectionId: insp2.id, checkpointId: checkpoints[1].id, value: 'pass', passed: true },
          { inspectionId: insp2.id, checkpointId: checkpoints[2].id, value: '1.5', passed: true },
        ],
      }).catch(() => {});
    }
  }

  // NCR 1 — closed with full investigation
  const ncr1 = await prisma.nonConformanceReport.create({
    data: {
      siteId: milan.id,
      reporterId: userQuality!.id,
      orderId: po1.id,
      workstationId: ws['CNC-01'].id,
      title: 'Bore diameter out of tolerance — Bracket XR-200',
      severity: 'major',
      description: 'Bore diameter measured 25.08 mm on 3 of 10 sampled parts (spec: 25±0.05 mm). Batch of 170 pcs affected.',
      defectQuantity: 51,
      rootCause: 'Tool wear on boring bar exceeded change interval. Operator did not perform scheduled tool-life check at 500 pcs.',
      containmentAction: 'Segregated affected batch. 100% inspection of remaining stock.',
      correctiveAction: 'Replaced boring bar. Added tool-life counter alarm to CNC program. Updated SOP-MC-004.',
      preventiveAction: 'Mandatory tool inspection every 400 pcs. Added checkpoint to CILT checklist for CNC-01.',
      verifiedById: userManager!.id,
      status: 'closed',
      closedAt: daysAgo(1, 16),
      createdAt: daysAgo(3, 15),
    },
  }).catch(() => null);

  // NCR 2 — open, under investigation
  await prisma.nonConformanceReport.create({
    data: {
      siteId: milan.id,
      reporterId: userOp2!.id,
      workstationId: ws['WLD-01'].id,
      title: 'Weld porosity on bracket subassembly',
      severity: 'minor',
      description: 'Visible porosity on 5 of 20 welded joints during visual inspection. Possible gas shielding issue.',
      defectQuantity: 5,
      containmentAction: 'Parts held for re-inspection.',
      status: 'investigation',
      createdAt: daysAgo(1, 9),
    },
  }).catch(() => {});

  // CAPA linked to closed NCR
  if (ncr1) {
    await prisma.correctiveAction.create({
      data: {
        siteId: milan.id,
        capaNumber: 'CAPA-2026-001',
        ncrId: ncr1.id,
        type: 'corrective',
        title: 'Tool-life monitoring for CNC boring operations',
        description: 'Implement automatic tool-life counter and alarm in CNC program. Update CILT checklist. Retrain operators on tool wear inspection.',
        assigneeId: userLean!.id,
        createdById: userQuality!.id,
        dueDate: daysAgo(-7), // 7 days from now
        priority: 'high',
        status: 'effective',
        rootCause: 'Tool wear exceeded change interval without detection',
        actionTaken: 'CNC program updated with tool-life counter alarm at 400 pcs. CILT checklist updated. Operators trained on 2026-04-01.',
        implementedAt: daysAgo(1, 10),
        verificationMethod: '30-day monitoring of bore dimensions — no recurrence',
        verifiedById: userManager!.id,
        effectivenessCheck: 'Monitored 3 consecutive batches (510 pcs total). All bore dimensions within spec. Zero NCRs.',
        effectivenessDate: daysAgo(0, 14),
        effectiveResult: 'effective',
        createdAt: daysAgo(2, 16),
      },
    }).catch(() => {});
  }

  // ── 14. Gemba Walk (1 completed) ──────────────────────────────────
  console.log('Creating gemba walk...');

  const gembaWalk = await prisma.gembaWalk.create({
    data: {
      siteId: milan.id,
      walkerId: userLean!.id,
      date: daysAgo(2).toISOString().slice(0, 10),
      startedAt: daysAgo(2, 8),
      endedAt: daysAgo(2, 9),
      status: 'completed',
    },
  }).catch(() => null);

  if (gembaWalk) {
    const gembaObs = [
      {
        walkId: gembaWalk.id,
        observerId: userLean!.id,
        workstationId: ws['CNC-01'].id,
        wasteCategory: 'waiting',
        severity: 'high',
        description: 'Operator waiting 12 min for raw material delivery from warehouse. No kanban signal in place.',
        operatorQuote: 'I wait for material almost every morning. Nobody tells the warehouse when to send it.',
        status: 'open',
        actionRequired: 'Implement 2-bin kanban system between warehouse and CNC area',
        assignedToId: userLean!.id,
        dueDate: daysAgo(-14),
      },
      {
        walkId: gembaWalk.id,
        observerId: userLean!.id,
        wasteCategory: 'motion',
        severity: 'medium',
        description: 'Operators walk 40m round-trip between CNC machines and measurement station for each part check.',
        status: 'open',
        actionRequired: 'Move portable CMM closer to machining area or install at-machine gauging',
        assignedToId: userManager!.id,
        dueDate: daysAgo(-21),
      },
      {
        walkId: gembaWalk.id,
        observerId: userLean!.id,
        workstationId: ws['ASM-01'].id,
        wasteCategory: 'overproduction',
        severity: 'medium',
        description: 'Assembly running batch size of 100 when downstream paint booth can only process 40/shift. WIP accumulating.',
        operatorQuote: 'We make the full batch because setup takes long. Then they sit here for 2 days.',
        status: 'investigating',
      },
      {
        walkId: gembaWalk.id,
        observerId: userLean!.id,
        workstationId: ws['CNC-02'].id,
        wasteCategory: 'defect',
        severity: 'high',
        description: 'Recurring burrs on milled housing edges. Operator manually deburring each piece — adds 30 sec/part.',
        operatorQuote: 'The cutter is worn but we have no spare. I file every part by hand.',
        status: 'open',
        actionRequired: 'Replace worn end mill. Evaluate deburring tool path in CNC program.',
        assignedToId: userShift!.id,
        dueDate: daysAgo(-7),
      },
    ];

    for (const obs of gembaObs) {
      await prisma.gembaObservation.create({ data: obs }).catch(() => {});
    }
  }

  // ── 15. Kaizen Ideas (3) ──────────────────────────────────────────
  console.log('Creating kaizen ideas...');

  const kaizenIdeas = [
    {
      siteId: milan.id,
      submittedById: userOp1!.id,
      title: 'Reduce changeover time on CNC-01 with pre-staging',
      problem: 'Changeover on CNC-01 takes 45 min because tools and fixtures are fetched during downtime. Operators walk to tool crib and back multiple times.',
      proposedSolution: 'Pre-stage next job tools and fixtures on a shadow board next to the machine during the current run. Use SMED internal/external split.',
      expectedImpact: 'high',
      area: 'Machining',
      status: 'submitted',
      expectedSavings: 15000,
      savingsType: 'time',
      createdAt: daysAgo(3, 7),
    },
    {
      siteId: milan.id,
      submittedById: userShift!.id,
      title: 'Add visual marks on Assembly Line for tool placement',
      problem: 'Assembly operators spend time searching for the correct tools. Different operators place tools in different spots, causing confusion during shift changes.',
      proposedSolution: 'Create foam cut-out shadow boards at each assembly station with labeled tool silhouettes. Color-code by station.',
      expectedImpact: 'medium',
      area: 'Assembly',
      status: 'approved',
      reviewedById: userLean!.id,
      reviewNotes: 'Good 5S improvement. Low cost, high visibility. Approved for implementation next week.',
      expectedSavings: 5000,
      costToImplement: 800,
      savingsType: 'productivity',
      createdAt: daysAgo(5, 14),
    },
    {
      siteId: milan.id,
      submittedById: userOp2!.id,
      title: 'Install air blow-off at Paint Booth entry',
      problem: 'Dust and fibers from assembly area contaminate parts entering the paint booth, causing paint defects and rework (approx 8% reject rate on painted parts).',
      proposedSolution: 'Install an air curtain/blow-off station at the paint booth entry to remove loose particles before painting.',
      expectedImpact: 'high',
      area: 'Finishing',
      status: 'completed',
      reviewedById: userManager!.id,
      reviewNotes: 'Excellent idea. Paint rework reduced from 8% to 1.5%.',
      implementedAt: daysAgo(1, 12),
      result: 'Air blow-off station installed. Paint defect rate dropped from 8% to 1.5% in first week. ROI achieved in 2 months.',
      expectedSavings: 25000,
      actualSavings: 28000,
      costToImplement: 3200,
      savingsType: 'quality',
      createdAt: daysAgo(7, 8),
    },
  ];

  for (const idea of kaizenIdeas) {
    await prisma.kaizenIdea.create({ data: idea }).catch(() => {});
  }

  console.log('Seed complete!');
  console.log('');
  console.log('Demo accounts (password: password123):');
  console.log('  System Roles:');
  console.log('    Corporate Admin:    admin@leanpilot.me');
  console.log('    Site Admin:         site.admin@leanpilot.me');
  console.log('    Viewer:             viewer@leanpilot.me');
  console.log('  Custom Roles (Milan):');
  console.log('    Full Access:        manager@leanpilot.me');
  console.log('    Lean Coordinator:   lean@leanpilot.me');
  console.log('    Quality Engineer:   quality@leanpilot.me');
  console.log('    Shift Leader:       shift.leader@leanpilot.me');
  console.log('    Operator:           operator1@leanpilot.me / operator2@leanpilot.me');
  console.log('    Shop Floor:         floor@leanpilot.me');
  console.log('');
  console.log('Milan Factory: 6 workstations, 3 POs, 19 reason codes, 3 shifts, 6 role templates');
  console.log('  Demo Data:');
  console.log('    13 production runs + breakdown events (OEE ~75%)');
  console.log('    3 completed 5S audits (Machining 67%, Assembly 80%, Finishing 50%)');
  console.log('    3 safety incidents (2 near-miss, 1 first aid)');
  console.log('    1 quality template, 2 inspections, 2 NCRs, 1 CAPA');
  console.log('    1 gemba walk with 4 observations');
  console.log('    3 kaizen ideas (submitted, approved, completed)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
