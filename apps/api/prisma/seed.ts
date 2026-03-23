// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Corporate
  const corporate = await prisma.corporate.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      name: 'Demo Manufacturing Group',
      slug: 'demo-corp',
    },
  });

  // 2. Create Sites
  const milanSite = await prisma.site.upsert({
    where: { corporateId_slug: { corporateId: corporate.id, slug: 'milan-factory' } },
    update: {},
    create: {
      name: 'Milan Factory',
      slug: 'milan-factory',
      location: 'Milan, Italy',
      timezone: 'Europe/Rome',
      corporateId: corporate.id,
    },
  });

  const belgradeSite = await prisma.site.upsert({
    where: { corporateId_slug: { corporateId: corporate.id, slug: 'belgrade-plant' } },
    update: {},
    create: {
      name: 'Belgrade Plant',
      slug: 'belgrade-plant',
      location: 'Belgrade, Serbia',
      timezone: 'Europe/Belgrade',
      corporateId: corporate.id,
    },
  });

  // 3. Create Users
  const password = await bcrypt.hash('password123', 12);

  const users = [
    { email: 'admin@leanpilot.me', firstName: 'Alberto', lastName: 'Grassi', role: 'corporate_admin', siteId: milanSite.id },
    { email: 'site.admin@leanpilot.me', firstName: 'Marco', lastName: 'Rossi', role: 'site_admin', siteId: milanSite.id },
    { email: 'manager@leanpilot.me', firstName: 'Luca', lastName: 'Bianchi', role: 'manager', siteId: milanSite.id },
    { email: 'operator@leanpilot.me', firstName: 'Giuseppe', lastName: 'Verdi', role: 'operator', siteId: milanSite.id },
    { email: 'viewer@leanpilot.me', firstName: 'Anna', lastName: 'Ferrari', role: 'viewer', siteId: milanSite.id },
    { email: 'belgrade.admin@leanpilot.me', firstName: 'Nikola', lastName: 'Jovanovic', role: 'site_admin', siteId: belgradeSite.id },
    { email: 'belgrade.operator@leanpilot.me', firstName: 'Milan', lastName: 'Petrovic', role: 'operator', siteId: belgradeSite.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        password,
        corporateId: corporate.id,
      },
    });
  }

  console.log('Seed complete!');
  console.log('');
  console.log('Demo accounts (all use password: password123):');
  console.log('  Corporate Admin: admin@leanpilot.me');
  console.log('  Site Admin:      site.admin@leanpilot.me');
  console.log('  Manager:         manager@leanpilot.me');
  console.log('  Operator:        operator@leanpilot.me');
  console.log('  Viewer:          viewer@leanpilot.me');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
