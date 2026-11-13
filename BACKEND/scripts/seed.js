const config = require('../config');
const db = require('../wrapper/db');
const userRepo = require('../datadomain/user.repository');
const driverProfileRepo = require('../datadomain/driver-profile.repository');
const { hashPassword } = require('../wrapper/password');

const PASSWORD = 'password123';

const DEMO_USERS = [
  { name: 'Demo Rider', email: 'rider@hopz.test', role: 'rider' },
  {
    name: 'Demo Driver One',
    email: 'driver1@hopz.test',
    role: 'driver',
    vehicle: { vehicleType: 'mini', vehicleModel: 'Maruti Swift', plate: 'DL01AB1234' },
  },
  {
    name: 'Demo Driver Two',
    email: 'driver2@hopz.test',
    role: 'driver',
    vehicle: { vehicleType: 'auto', vehicleModel: 'Bajaj RE', plate: 'DL01CD5678' },
  },
];

async function main() {
  // Demo passwords are public, so never seed a real environment.
  if (config.nodeEnv === 'production') throw new Error('Refusing to seed in production');

  const passwordHash = await hashPassword(PASSWORD);
  for (const u of DEMO_USERS) {
    if (await userRepo.findByEmail(u.email)) {
      console.log(`exists   ${u.email}`);
      continue;
    }
    await db.withTransaction(async (client) => {
      const row = await userRepo.create({ ...u, passwordHash }, client);
      if (u.vehicle) await driverProfileRepo.create({ userId: row.id, ...u.vehicle }, client);
    });
    console.log(`created  ${u.email} (${u.role})`);
  }
  console.log(`Done. Password for all demo users: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
