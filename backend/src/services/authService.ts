import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { userRepository } from '../repositories/userRepository.js';
import { badRequest, unauthorized } from '../utils/errors.js';
import { query } from '../db/index.js';
import type { AuthUser } from '../types/auth.js';

export const authService = {
  async register(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || password.length < 8) {
      throw badRequest('Email and password are required. Password must be at least 8 characters long.');
    }

    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw badRequest('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ email: normalizedEmail, passwordHash });

    if (!user) {
      throw badRequest('Unable to create user');
    }

    return {
      user: await userRepository.toAuthUser(user),
      accessToken: this.generateAccessToken(user),
      refreshToken: await this.generateRefreshToken(user.id),
    };
  },

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw unauthorized('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw unauthorized('Invalid email or password');
    }

    return {
      user: await userRepository.toAuthUser(user),
      accessToken: this.generateAccessToken(user),
      refreshToken: await this.generateRefreshToken(user.id),
    };
  },

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw unauthorized('Refresh token is required');
    }

    const rows = await query<{ user_id: string; token_hash: string; expires_at: string; id: string }>(
      `
        SELECT id, user_id, token_hash, expires_at
        FROM refresh_tokens
        WHERE revoked_at IS NULL
      `,
    );

    const matching = rows.find((row) => bcrypt.compareSync(refreshToken, row.token_hash));
    if (!matching) {
      throw unauthorized('Invalid refresh token');
    }

    if (new Date(matching.expires_at).getTime() < Date.now()) {
      throw unauthorized('Refresh token has expired');
    }

    const user = await userRepository.findById(matching.user_id);
    if (!user) {
      throw unauthorized('User no longer exists');
    }

    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: await this.rotateRefreshToken(matching.id, user.id),
    };
  },

  async logout(refreshToken: string) {
    if (!refreshToken) {
      return;
    }

    const rows = await query<{ id: string; token_hash: string }>(
      `
        SELECT id, token_hash
        FROM refresh_tokens
        WHERE revoked_at IS NULL
      `,
    );

    const matching = rows.find((row) => bcrypt.compareSync(refreshToken, row.token_hash));
    if (!matching) {
      return;
    }

    await query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
      `,
      [matching.id],
    );
  },

  generateAccessToken(user: { id: string; email: string; role: string }) {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      env.jwtAccessSecret,
      { expiresIn: env.accessTokenExpiresIn as jwt.SignOptions['expiresIn'] },
    );
  },

  async generateRefreshToken(userId: string) {
    const token = randomUUID();
    const tokenHash = await bcrypt.hash(token, 10);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    await query(
      `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), userId, tokenHash, expiresAt],
    );

    return token;
  },

  async rotateRefreshToken(id: string, userId: string) {
    const token = randomUUID();
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    await query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
      `,
      [id],
    );

    await query(
      `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), userId, tokenHash, expiresAt],
    );

    return token;
  },
};
