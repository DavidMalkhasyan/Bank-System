import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

const getNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getSecret = (name: string, fallback: string) => {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    throw new Error(`${name} must be set in production`);
  }
  return fallback;
};

export const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: getNumber(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:15432/banking',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  // Redis is optional: leave REDIS_URL empty to run without the cache.
  redisUrl: process.env.REDIS_URL ?? '',
  jwtAccessSecret: getSecret('JWT_ACCESS_SECRET', 'dev-access-secret'),
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
  refreshTokenTtlDays: getNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Seed demo users and history on startup when the database has no users.
  seedDemoData: process.env.SEED_DEMO_DATA !== 'false',
  // When > 0, wipe all data and reseed the demo every N hours (for public demos).
  demoResetHours: getNumber(process.env.DEMO_RESET_HOURS, 0),
  // When set, the API also serves the built frontend from this folder.
  staticDir: process.env.STATIC_DIR ?? '',
};
