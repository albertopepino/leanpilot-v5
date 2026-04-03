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
    description: 'Quality technician — inspections, NCR, root cause analysis',
    permissions: {
      production: 'view',
      shift_management: 'view',
      continuous_improvement: 'participate',
      quality: 'manage',
      problem_solving: 'manage',
      safety: 'participate',
      maintenance: 'view',
      people: 'view',
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
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
