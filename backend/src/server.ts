import app from './app.js';
import { env } from './config/env.js';
import { DEMO_PASSWORD, DEMO_USERS, lastDemoSeedAt, seedDemoData } from './db/demoData.js';
import { pool } from './db/index.js';
import { runMigrations } from './db/migrations.js';
import { connectRedis, disconnectRedis } from './db/redis.js';

// setTimeout cannot wait longer than ~24.8 days.
const MAX_TIMEOUT_MS = 2_147_000_000;

/**
 * Restores the demo data every `hours` hours. The time of the last reset is
 * read from the database instead of relying on a timer alone, so resets still
 * happen on hosts that put idle servers to sleep (like Render's free tier).
 */
function scheduleDemoResets(hours: number) {
  const intervalMs = hours * 60 * 60 * 1000;
  let timer: NodeJS.Timeout | undefined;

  const check = async () => {
    let nextCheckMs = intervalMs;
    try {
      const lastReset = await lastDemoSeedAt();
      const dueInMs = lastReset ? lastReset.getTime() + intervalMs - Date.now() : 0;
      if (dueInMs <= 0) {
        await seedDemoData({ reset: true });
        console.log('Demo data reset');
      } else {
        nextCheckMs = dueInMs;
      }
    } catch (error) {
      console.error('Demo data reset failed:', error);
      nextCheckMs = Math.min(intervalMs, 60 * 60 * 1000);
    }
    timer = setTimeout(check, Math.min(nextCheckMs, MAX_TIMEOUT_MS));
  };

  void check();
  return () => clearTimeout(timer);
}

async function start() {
  await runMigrations();

  if (env.seedDemoData && (await seedDemoData())) {
    console.log(`Seeded demo data. Demo logins (password "${DEMO_PASSWORD}"): ${Object.values(DEMO_USERS).map((user) => user.email).join(', ')}`);
  }

  await connectRedis();

  const server = app.listen(env.port, () => {
    console.log(`Banking API listening on http://localhost:${env.port}`);
  });

  // Runs in the background, so a reset never delays the server from answering.
  const stopDemoResets = env.demoResetHours > 0 ? scheduleDemoResets(env.demoResetHours) : () => undefined;

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    stopDemoResets();
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
