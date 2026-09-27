import { randomUUID } from 'node:crypto';
import { query } from '../db/index.js';
import type { AuditLog } from '../types/account.js';

export const auditRepository = {
  async create(payload: {
    userId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const rows = await query<AuditLog>(
      `
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        randomUUID(),
        payload.userId ?? null,
        payload.action,
        payload.entityType ?? null,
        payload.entityId ?? null,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
      ],
    );

    return rows[0] ?? null;
  },

  async listAll(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return query<AuditLog>(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
  },
};
