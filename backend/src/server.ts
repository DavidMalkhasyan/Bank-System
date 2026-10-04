import app from './app.js';
import { env } from './config/env.js';
import { DEMO_PASSWORD, DEMO_USERS, seedDemoData } from './db/demoData.js';
import { pool } from './db/index.js';
import { runMigrations } from './db/migrations.js';
import { connectRedis, disconnectRedis } from './db/redis.js';

async function start() {
  await runMigrations();

  if (env.seedDemoData && (await seedDemoData())) {
    console.log(`Seeded demo data. Demo logins (password "${DEMO_PASSWORD}"): ${Object.values(DEMO_USERS).map((user) => user.email).join(', ')}`);
  }

  await connectRedis();

  const server = app.listen(env.port, () => {
    console.log(`Banking API listening on http://localhost:${env.port}`);
  });

  // A public demo gets messy; optionally restore the demo data on a schedule.
  const resetTimer =
    env.demoResetHours > 0
      ? setInterval(() => {
          seedDemoData({ reset: true })
            .then(() => console.log('Demo data reset'))
            .catch((error) => console.error('Demo data reset failed:', error));
        }, env.demoResetHours * 60 * 60 * 1000)
      : undefined;

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    clearInterval(resetTimer);
    server.close(async () => {
      await disconnectRedis();
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start the API:', error);
  process.exit(1);
});
