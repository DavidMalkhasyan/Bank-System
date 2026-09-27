import { randomUUID } from 'node:crypto';
import { query } from '../db/index.js';
import type { AuthUser, User, UserRole } from '../types/auth.js';

export const userRepository = {
  async findByEmail(email: string) {
    const rows = await query<User>(
      `
        SELECT id, email, password_hash, role, created_at, updated_at
        FROM users
        WHERE email = $1
      `,
      [email],
    );

    return rows[0] ?? null;
  },

  async findById(id: string) {
    const rows = await query<User>(
      `
        SELECT id, email, password_hash, role, created_at, updated_at
        FROM users
        WHERE id = $1
      `,
      [id],
    );

    return rows[0] ?? null;
  },

  async create({ email, passwordHash, role = 'CUSTOMER' }: { email: string; passwordHash: string; role?: UserRole }) {
    const id = randomUUID();

    const rows = await query<User>(
      `
        INSERT INTO users (id, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, password_hash, role, created_at, updated_at
      `,
      [id, email, passwordHash, role],
    );

    return rows[0];
  },

  async list() {
    return query<User>(`SELECT id, email, password_hash, role, created_at, updated_at FROM users ORDER BY created_at DESC`);
  },

  async updateRole(id: string, role: UserRole) {
    const rows = await query<User>(
      `
        UPDATE users
        SET role = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, password_hash, role, created_at, updated_at
      `,
      [id, role],
    );

    return rows[0] ?? null;
  },

  async toAuthUser(user: User): Promise<AuthUser> {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    };
  },
};
