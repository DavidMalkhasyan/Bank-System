import * as pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg as unknown as { Pool: any };

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const query = async <T = unknown>(text: string, params: unknown[] = []) => {
  const result = (await pool.query(text, params)) as unknown as { rows: T[] };
  return result.rows;
};
