import { pool, query, type Db } from '../db/index.js';
import type { UserRole, UserRow } from '../types/domain.js';

export const toUserDto = (user: UserRow) => ({
  id: user.id,
  email: user.email,
  fullName: user.full_name,
  role: user.role,
  createdAt: user.created_at,
});

export type UserDto = ReturnType<typeof toUserDto>;

export const userRepository = {
  async findByEmail(email: string) {
    const rows = await query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
    return rows[0] ?? null;
  },

  async findById(id: string) {
    const rows = await query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async create(
    { email, fullName, passwordHash, role = 'CUSTOMER' }: { email: string; fullName: string; passwordHash: string; role?: UserRole },
    db: Db = pool,
  ) {
    const rows = await query<UserRow>(
      `
        INSERT INTO users (email, full_name, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [email, fullName, passwordHash, role],
      db,
    );
    return rows[0]!;
  },

  async updateProfile(id: string, fullName: string) {
    const rows = await query<UserRow>(
      `UPDATE users SET full_name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, fullName],
    );
    return rows[0] ?? null;
  },

  async updatePassword(id: string, passwordHash: string, db: Db = pool) {
    await query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [id, passwordHash], db);
  },

  async updateRole(id: string, role: UserRole) {
    const rows = await query<UserRow>(
      `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, role],
    );
    return rows[0] ?? null;
  },

  /** Admin listing with per-user account counts; never returns password hashes. */
  async list({ page, pageSize, search }: { page: number; pageSize: number; search?: string }) {
    const params: unknown[] = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE u.email ILIKE $1 OR u.full_name ILIKE $1`;
    }

    const [countRow] = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params);
    const rows = await query<UserRow & { accounts_count: number; last_login_at: Date | null }>(
      `
        SELECT u.*,
          (SELECT COUNT(*)::int FROM accounts a WHERE a.user_id = u.id) AS accounts_count,
          (SELECT MAX(created_at) FROM audit_logs l WHERE l.user_id = u.id AND l.action = 'LOGIN') AS last_login_at
        FROM users u
        ${where}
        ORDER BY u.created_at DESC, u.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, pageSize, (page - 1) * pageSize],
    );

    return {
      items: rows.map((row) => ({
        ...toUserDto(row),
        accountsCount: row.accounts_count,
        lastLoginAt: row.last_login_at,
      })),
      page,
      pageSize,
      total: countRow?.total ?? 0,
    };
  },
};
