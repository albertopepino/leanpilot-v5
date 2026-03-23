// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  // 3. Users
  const pw = await bcrypt.hash('password123', 12);
  const users = [
    { email: 'admin@leanpilot.me', firstName: 'Alberto', lastName: 'Grassi', role: 'corporate_admin', siteId: milan.id },
    { email: 'site.admin@leanpilot.me', firstName: 'Marco', lastName: 'Rossi', role: 'site_admin', siteId: milan.id },
    { email: 'manager@leanpilot.me', firstName: 'Luca', lastName: 'Bianchi', role: 'manager', siteId: milan.id },
    { email: 'operator1@leanpilot.me', firstName: 'Giuseppe', lastName: 'Verdi', role: 'operator', siteId: milan.id },
    { email: 'operator2@leanpilot.me', firstName: 'Paolo', lastName: 'Neri', role: 'operator', siteId: milan.id },
    { email: 'viewer@leanpilot.me', firstName: 'Anna', lastName: 'Ferrari', role: 'viewer', siteId: milan.id },
    { email: 'belgrade.admin@leanpilot.me', firstName: 'Nikola', lastName: 'Jovanovic', role: 'site_admin', siteId: belgrade.id },
    { email: 'belgrade.operator@leanpilot.me', firstName: 'Milan', lastName: 'Petrovic', role: 'operator', siteId: belgrade.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: pw, corporateId: corporate.id },
    });
  }

  // 4. Workstations (Milan)
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

  // 5. Shift Definitions (Milan)
  const shiftDefs = [
    { siteId: milan.id, name: 'Morning', startTime: '06:00', endTime: '14:00', days: '["mon","tue","wed","thu","fri"]' },
    { siteId: milan.id, name: 'Afternoon', startTime: '14:00', endTime: '22:00', days: '["mon","tue","wed","thu","fri"]' },
    { siteId: milan.id, name: 'Night', startTime: '22:00', endTime: '06:00', days: '["mon","tue","wed","thu","fri"]' },
  ];
  for (const s of shiftDefs) {
    await prisma.shiftDefinition.create({ data: s }).catch(() => {});
  }

  // 6. Reason Codes (Milan)
  const reasons = [
    // Breakdown reasons
    { category: 'breakdown', code: 'MECH', label: 'Mechanical failure' },
    { category: 'breakdown', code: 'ELEC', label: 'Electrical failure' },
    { category: 'breakdown', code: 'PNEU', label: 'Pneumatic/hydraulic' },
    { category: 'breakdown', code: 'TOOL', label: 'Tool breakage' },
    { category: 'breakdown', code: 'SOFT', label: 'Software/program error' },
    { category: 'breakdown', code: 'OTHR', label: 'Other' },
    // Changeover reasons
    { category: 'changeover', code: 'FMT', label: 'Format change' },
    { category: 'changeover', code: 'MAT', label: 'Material change' },
    { category: 'changeover', code: 'TOOL', label: 'Tool change' },
    // Quality hold reasons
    { category: 'quality', code: 'DIM', label: 'Dimensional issue' },
    { category: 'quality', code: 'VIS', label: 'Visual defect' },
    { category: 'quality', code: 'FUNC', label: 'Functional issue' },
    { category: 'quality', code: 'MATL', label: 'Material defect' },
    // Idle reasons
    { category: 'idle', code: 'WAIT', label: 'Waiting for material' },
    { category: 'idle', code: 'INST', label: 'Waiting for instructions' },
    { category: 'idle', code: 'OPER', label: 'No operator available' },
    // Planned stop
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

  // 7. Production Orders with Phases (Milan)
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
  });

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
  });

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
  });

  console.log('Seed complete!');
  console.log('');
  console.log('Demo accounts (password: password123):');
  console.log('  Corporate Admin:  admin@leanpilot.me');
  console.log('  Site Admin:       site.admin@leanpilot.me');
  console.log('  Manager:          manager@leanpilot.me');
  console.log('  Operator 1:       operator1@leanpilot.me');
  console.log('  Operator 2:       operator2@leanpilot.me');
  console.log('');
  console.log('Milan Factory: 6 workstations, 3 POs, 19 reason codes, 3 shifts');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
