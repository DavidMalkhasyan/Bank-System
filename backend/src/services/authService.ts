import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { pool, query, withTransaction, type Db } from '../db/index.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { toUserDto, userRepository } from '../repositories/userRepository.js';
import type { UserRow } from '../types/domain.js';
import { badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';

const BCRYPT_ROUNDS = 10;
export const WELCOME_BONUS = '1000.00';

// Compared against when the email is unknown, so both paths take the same time.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_ROUNDS);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function issueTokens(user: UserRow, db: Db = pool) {
  const accessToken = jwt.sign({ email: user.email, role: user.role }, env.jwtAccessSecret, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.accessTokenExpiresIn as jwt.SignOptions['expiresIn'],
  });

  // Refresh tokens are opaque random strings; only their SHA-256 digest is stored.
  const refreshToken = randomBytes(48).toString('base64url');
  await query(
    `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + make_interval(days => $3))
    `,
    [user.id, hashToken(refreshToken), env.refreshTokenTtlDays],
    db,
  );

  return { accessToken, refreshToken };
}

const session = async (user: UserRow, db?: Db) => ({ user: toUserDto(user), ...(await issueTokens(user, db)) });

export const authService = {
  async register({ email, password, fullName }: { email: string; password: string; fullName: string }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await userRepository.findByEmail(normalizedEmail)) {
      throw conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // New customers start with a funded checking account so the demo is usable right away.
    const user = await withTransaction(async (client) => {
      const created = await userRepository.create({ email: normalizedEmail, fullName: fullName.trim(), passwordHash }, client);
      const account = await accountRepository.create(
        { userId: created.id, name: 'Everyday Checking', type: 'CHECKING', currency: 'USD' },
        client,
      );
      await accountRepository.applyDelta(client, account.id, WELCOME_BONUS);
      await transactionRepository.create(
        {
          initiatorId: created.id,
          sourceAccountId: null,
          destinationAccountId: account.id,
          amount: WELCOME_BONUS,
          currency: 'USD',
          type: 'DEPOSIT',
          description: 'Welcome bonus',
        },
        client,
      );
      await auditRepository.create({ userId: created.id, action: 'USER_REGISTERED', entityType: 'user', entityId: created.id }, client);
      return created;
    });

    return session(user);
  },

  async login(email: string, password: string, context: { ip?: string; userAgent?: string } = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);
    const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      await auditRepository.create({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user?.id ?? null,
        metadata: { email: normalizedEmail, ip: context.ip },
      });
      throw unauthorized('Invalid email or password');
    }

    await auditRepository.create({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      metadata: { ip: context.ip, userAgent: context.userAgent?.slice(0, 200) },
    });

    return session(user);
  },

  /** Rotates the refresh token: the old one is revoked and a new pair is issued. */
  async refresh(refreshToken: string) {
    const [stored] = await query<{ id: string; user_id: string; expires_at: Date; revoked_at: Date | null }>(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
      [hashToken(refreshToken)],
    );

    if (!stored) {
      throw unauthorized('Invalid refresh token');
    }

    if (stored.revoked_at) {
      // A token that was rotated a while ago is being reused: treat it as stolen
      // and end every session of that user. A short grace window covers two
      // browser tabs refreshing at the same moment.
      if (Date.now() - stored.revoked_at.getTime() > 30_000) {
        await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [stored.user_id]);
        await auditRepository.create({ userId: stored.user_id, action: 'REFRESH_TOKEN_REUSED', entityType: 'user', entityId: stored.user_id });
      }
      throw unauthorized('Session expired, please sign in again');
    }

    if (stored.expires_at.getTime() < Date.now()) {
      throw unauthorized('Session expired, please sign in again');
    }

    const user = await userRepository.findById(stored.user_id);
    if (!user) {
      throw unauthorized('User no longer exists');
    }

    return withTransaction(async (client) => {
      const revoked = await query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
        [stored.id],
        client,
      );
      if (revoked.length === 0) {
        throw unauthorized('Session expired, please sign in again');
      }
      return session(user, client);
    });
  },

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(refreshToken)],
    );
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw notFound('User not found');
    return toUserDto(user);
  },

  async updateProfile(userId: string, fullName: string) {
    const user = await userRepository.updateProfile(userId, fullName.trim());
    if (!user) throw notFound('User not found');
    await auditRepository.create({ userId, action: 'PROFILE_UPDATED', entityType: 'user', entityId: userId });
    return toUserDto(user);
  },

  /** Changes the password, signs out every other session and returns a fresh one. */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw notFound('User not found');

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw badRequest('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw badRequest('New password must be different from the current one');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return withTransaction(async (client) => {
      await userRepository.updatePassword(userId, passwordHash, client);
      await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId], client);
      await auditRepository.create({ userId, action: 'PASSWORD_CHANGED', entityType: 'user', entityId: userId }, client);
      return session({ ...user, password_hash: passwordHash }, client);
    });
  },
};
