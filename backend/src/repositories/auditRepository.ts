import { pool, query, type Db } from '../db/index.js';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export const auditRepository = {
  /** Pass the transaction client so the audit row commits or rolls back with the change. */
  async create(entry: AuditEntry, db: Db = pool) {
    await query(
      `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        entry.userId ?? null,
        entry.action,
        entry.entityType ?? null,
        entry.entityId ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
      db,
    );
  },

  async list({ page, pageSize, action }: { page: number; pageSize: number; action?: string }) {
    const params: unknown[] = [];
    let where = '';
    if (action) {
      params.push(action);
      where = `WHERE l.action = $${params.length}`;
    }

    const [countRow] = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM audit_logs l ${where}`,
      params,
    );

    const rows = await query<{
      id: string;
      user_id: string | null;
      user_email: string | null;
      user_name: string | null;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `
        SELECT l.*, u.email AS user_email, u.full_name AS user_name
        FROM audit_logs l
        LEFT JOIN users u ON u.id = l.user_id
        ${where}
        ORDER BY l.created_at DESC, l.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, pageSize, (page - 1) * pageSize],
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        createdAt: row.created_at,
        user: row.user_id ? { id: row.user_id, email: row.user_email, fullName: row.user_name } : null,
      })),
      page,
      pageSize,
      total: countRow?.total ?? 0,
    };
  },

  async listActions() {
    const rows = await query<{ action: string }>(`SELECT DISTINCT action FROM audit_logs ORDER BY action`);
    return rows.map((row) => row.action);
  },
};
