/* eslint-disable no-console */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // ----- Course levels -----
  const levels = [
    { key: 'PRIMARY', name: 'ประถมปลาย (ป.4-6)', sortOrder: 1, description: 'คณิตพื้นฐาน + ตะลุยโจทย์สอบเข้า ม.1' },
    { key: 'JUNIOR',  name: 'มัธยมต้น (ม.1-3)',  sortOrder: 2, description: 'คณิตพื้นฐานตามหลักสูตร ม.ต้น' },
    { key: 'SENIOR',  name: 'มัธยมปลาย (ม.4-6)', sortOrder: 3, description: 'คณิตพื้นฐานตามหลักสูตร ม.ปลาย' },
  ];

  for (const l of levels) {
    await prisma.courseLevel.upsert({
      where: { key: l.key },
      update: { name: l.name, sortOrder: l.sortOrder, description: l.description },
      create: l,
    });
  }
  console.log(`✅ Seeded ${levels.length} course levels`);

  // ----- Default admin -----
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@highbrainnet.local';
  const adminPass  = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';

  const hash = await bcrypt.hash(adminPass, Number(process.env.BCRYPT_COST || 12));
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      email: adminEmail,
      passwordHash: hash,
      fullName: 'HighBrainnet Admin',
      role: 'ADMIN',
      pdpaConsent: true,
      pdpaConsentAt: new Date(),
      pdpaVersion: 'v1',
    },
  });
  console.log(`✅ Admin ready: ${adminEmail} (password: ${adminPass})`);

  // ----- App settings (singleton row id=1) -----
  await prisma.appSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      paymentMode: 'MANUAL',
      qrSource: 'PROMPTPAY',
      promptpayType: 'PHONE',
      slipProvider: 'mock',
    },
  });
  console.log('✅ App settings ready (paymentMode=MANUAL, qrSource=PROMPTPAY)');
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
