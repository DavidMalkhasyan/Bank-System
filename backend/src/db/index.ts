import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/** Anything that can run a query: the pool, or a client inside a transaction. */
export type Db = pg.Pool | pg.PoolClient;

export const query = async <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool,
) => {
  const result = await db.query<T>(text, params);
  return result.rows;
};

/** Runs `work` inside BEGIN/COMMIT and rolls back if it throws. */
export const withTransaction = async <T>(work: (client: pg.PoolClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};
