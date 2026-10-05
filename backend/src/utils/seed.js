require('dotenv').config();
const prisma = require('./db');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Seeding database...');

  // Clinic
  let clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        name: 'عيادة التجميل والليزر',
        phone: '966500000000',
        email: 'info@clinic.com',
        currency: 'SAR',
        timezone: 'Asia/Riyadh',
      },
    });
    console.log('✅ Clinic created');
  }

  // Default branch
  let branch = await prisma.branch.findFirst({ where: { clinicId: clinic.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'الفرع الرئيسي',
        clinicId: clinic.id,
        address: 'الرياض',
      },
    });
    console.log('✅ Branch created');
  }

  // Super admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@clinic.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        fullName: 'مدير النظام',
        email: adminEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        branchId: branch.id,
        clinicId: clinic.id,
      },
    });
    console.log(`✅ Admin created: ${adminEmail} / (${process.env.SEED_ADMIN_PASSWORD ? 'from SEED_ADMIN_PASSWORD' : 'Admin@123'})`);
  }

  // Default settings for clinic (generic, no medical assumptions)
  const defaultSettings = [
    { key: 'clinic_name', value: JSON.stringify(clinic.name), group: 'clinic', category: 'general' },
    { key: 'currency', value: JSON.stringify('SAR'), group: 'clinic', category: 'general' },
    { key: 'appointment_buffer', value: JSON.stringify(15), group: 'scheduling', category: 'general' },
    { key: 'appointment_reminder', value: JSON.stringify(true), group: 'scheduling', category: 'notification' },
    { key: 'invoice_tax_rate', value: JSON.stringify(0), group: 'billing', category: 'general' },
    { key: 'default_appointment_duration', value: JSON.stringify(30), group: 'scheduling', category: 'general' },
    { key: 'inventory_low_stock_alert', value: JSON.stringify(true), group: 'inventory', category: 'notification' },
    { key: 'device_maintenance_alert_days', value: JSON.stringify(7), group: 'device', category: 'notification' },
  ];

  for (const s of defaultSettings) {
    const exists = await prisma.setting.findUnique({ where: { key: s.key } });
    if (!exists) {
      await prisma.setting.create({ data: s });
    }
  }
  console.log('✅ Default settings created');

  // Example doctor user
  const doctorEmail = 'doctor@clinic.com';
  const existingDoctor = await prisma.user.findUnique({ where: { email: doctorEmail } });
  if (!existingDoctor) {
    const hashedPassword = await bcrypt.hash(process.env.SEED_DOCTOR_PASSWORD || 'Doctor@123', 10);
    await prisma.user.create({
      data: {
        fullName: 'د. أحمد',
        email: doctorEmail,
        password: hashedPassword,
        role: 'DOCTOR',
        status: 'ACTIVE',
        branchId: branch.id,
        clinicId: clinic.id,
        commissionRate: 10,
      },
    });
    console.log('✅ Doctor created: doctor@clinic.com');
  }

  const receptionEmail = 'reception@clinic.com';
  const existingReception = await prisma.user.findUnique({ where: { email: receptionEmail } });
  if (!existingReception) {
    const hashedPassword = await bcrypt.hash('Reception@123', 10);
    await prisma.user.create({
      data: {
        fullName: 'موظفة الاستقبال',
        email: receptionEmail,
        password: hashedPassword,
        role: 'RECEPTIONIST',
        status: 'ACTIVE',
        branchId: branch.id,
        clinicId: clinic.id,
      },
    });
    console.log('✅ Receptionist created: reception@clinic.com / Reception@123');
  }

  console.log('✅ Seeding completed successfully');
  console.log('\nLogin credentials (defaults unless overridden by env):');
  console.log('  Admin:       admin@clinic.com / Admin@123');
  console.log('  Doctor:      doctor@clinic.com / Doctor@123');
  console.log('  Reception:   reception@clinic.com / Reception@123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
