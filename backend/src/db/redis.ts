import { createClient } from 'redis';
import { env } from '../config/env.js';

let client: ReturnType<typeof createClient> | null = null;

/** Connects once. The app keeps working without Redis; cache calls become no-ops. */
export async function connectRedis() {
  if (!env.redisUrl || client) return;

  client = createClient({
    url: env.redisUrl,
    socket: {
      connectTimeout: 2_000,
      reconnectStrategy: (retries) => (retries > 10 ? false : Math.min(retries * 500, 5_000)),
    },
  });
  client.on('error', () => {
    // Errors are expected when Redis is down; reads fall back to PostgreSQL.
  });

  try {
    await client.connect();
    console.log('Redis connected');
  } catch {
    console.warn('Redis unavailable, continuing without cache');
  }
}

const isReady = () => client?.isReady === true;

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isReady()) return null;
  try {
    const raw = await client!.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60) {
  if (!isReady()) return;
  try {
    await client!.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Cache writes are best effort.
  }
}

export async function cacheDel(...keys: string[]) {
  if (!isReady() || keys.length === 0) return;
  try {
    await client!.del(keys);
  } catch {
    // Cache invalidation is best effort; entries also expire by TTL.
  }
}

export async function disconnectRedis() {
  if (client?.isOpen) {
    await client.quit().catch(() => undefined);
  }
  client = null;
}
