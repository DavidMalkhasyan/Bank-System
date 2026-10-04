import { DEMO_PASSWORD, DEMO_USERS, seedDemoData } from './demoData.js';
import { pool } from './index.js';
import { runMigrations } from './migrations.js';

// Usage: npm run seed            (only seeds an empty database)
//        npm run seed -- --reset (wipes all data and seeds again)
const reset = process.argv.includes('--reset');

async function main() {
  await runMigrations();
  const seeded = await seedDemoData({ reset });
  if (!seeded) {
    console.log('Database already has users; nothing seeded. Use --reset to wipe and reseed.');
    return;
  }
  console.log('Demo data loaded. Sign in with any of these (password: %s):', DEMO_PASSWORD);
  for (const user of Object.values(DEMO_USERS)) {
    console.log(`  ${user.role.padEnd(8)} ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
