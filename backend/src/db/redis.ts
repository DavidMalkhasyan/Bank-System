import { createClient } from 'redis';
import { env } from '../config/env.js';

const client = createClient({ url: env.redisUrl });

let connected = false;

client.on('error', () => {
  // swallow errors, app should continue without redis
});

export async function connectRedis() {
  if (connected) return;
  try {
    await client.connect();
    connected = true;
  } catch {
    // ignore; operations will handle missing connection
  }
}

export async function getJson<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds = 60) {
  try {
    const raw = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await client.setEx(key, ttlSeconds, raw);
    } else {
      await client.set(key, raw);
    }
  } catch {
    // ignore
  }
}

export async function del(key: string) {
  try {
    await client.del(key);
  } catch {
    // ignore
  }
}

export default client;
