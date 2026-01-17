/**
 * Custom PostgreSQL Adapter for NextAuth
 * This adapter works with our exact database schema (camelCase columns)
 */

import type { Adapter } from "next-auth/adapters"
import { getContaboPool } from "@/lib/database/contabo-pool"

export function CustomPgAdapter(): Adapter {
  const pool = getContaboPool()

  return {
    async createUser(user) {
      const result = await pool.query(
        `INSERT INTO users (id, email, name, "emailVerified", image, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, NOW(), NOW())
         RETURNING id, email, name, "emailVerified", image, "createdAt", "updatedAt"`,
        [user.email, user.name, user.emailVerified, user.image]
      )
      return {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        emailVerified: result.rows[0].emailVerified,
        image: result.rows[0].image,
      }
    },

    async getUser(id) {
      const result = await pool.query(
        `SELECT id, email, name, "emailVerified", image, "createdAt", "updatedAt" FROM users WHERE id = $1`,
        [id]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        emailVerified: row.emailVerified,
        image: row.image,
      }
    },

    async getUserByEmail(email) {
      const result = await pool.query(
        `SELECT id, email, name, "emailVerified", image, "createdAt", "updatedAt" FROM users WHERE email = $1`,
        [email]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        emailVerified: row.emailVerified,
        image: row.image,
      }
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const result = await pool.query(
        `SELECT u.id, u.email, u.name, u."emailVerified", u.image, u."createdAt", u."updatedAt"
         FROM users u
         JOIN accounts a ON u.id = a."userId"
         WHERE a.provider = $1 AND a."providerAccountId" = $2`,
        [provider, providerAccountId]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        emailVerified: row.emailVerified,
        image: row.image,
      }
    },

    async updateUser(user) {
      const result = await pool.query(
        `UPDATE users SET email = $1, name = $2, "emailVerified" = $3, image = $4, "updatedAt" = NOW()
         WHERE id = $5
         RETURNING id, email, name, "emailVerified", image, "createdAt", "updatedAt"`,
        [user.email, user.name, user.emailVerified, user.image, user.id]
      )
      const row = result.rows[0]
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        emailVerified: row.emailVerified,
        image: row.image,
      }
    },

    async linkAccount(account) {
      await pool.query(
        `INSERT INTO accounts (id, "userId", type, provider, "providerAccountId", "refreshToken", "accessToken", "expiresAt", "tokenType", scope, "idToken", "sessionState", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (provider, "providerAccountId") DO UPDATE
         SET "refreshToken" = EXCLUDED."refreshToken", "accessToken" = EXCLUDED."accessToken", "expiresAt" = EXCLUDED."expiresAt", "tokenType" = EXCLUDED."tokenType", scope = EXCLUDED.scope, "idToken" = EXCLUDED."idToken", "sessionState" = EXCLUDED."sessionState", "updatedAt" = NOW()`,
        [
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token,
          account.access_token,
          account.expires_at ? Math.floor(account.expires_at) : null,
          account.token_type,
          account.scope,
          account.id_token,
          account.session_state,
        ]
      )
      return account
    },

    async createSession({ sessionToken, userId, expires }) {
      const result = await pool.query(
        `INSERT INTO sessions (id, "sessionToken", "userId", expires, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, NOW(), NOW())
         RETURNING id, "sessionToken", "userId", expires`,
        [sessionToken, userId, expires]
      )
      const row = result.rows[0]
      return {
        sessionToken: row.sessionToken,
        userId: row.userId,
        expires: row.expires,
      }
    },

    async getSessionAndUser(sessionToken) {
      const result = await pool.query(
        `SELECT s.id, s."sessionToken", s."userId", s.expires, u.id as "user.id", u.email, u.name, u."emailVerified", u.image
         FROM sessions s
         JOIN users u ON s."userId" = u.id
         WHERE s."sessionToken" = $1 AND s.expires > NOW()`,
        [sessionToken]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        session: {
          sessionToken: row.sessionToken,
          userId: row.userId,
          expires: row.expires,
        },
        user: {
          id: row["user.id"],
          email: row.email,
          name: row.name,
          emailVerified: row.emailVerified,
          image: row.image,
        },
      }
    },

    async updateSession({ sessionToken, ...data }) {
      const result = await pool.query(
        `UPDATE sessions SET "userId" = $1, expires = $2, "updatedAt" = NOW()
         WHERE "sessionToken" = $3
         RETURNING id, "sessionToken", "userId", expires`,
        [data.userId, data.expires, sessionToken]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        sessionToken: row.sessionToken,
        userId: row.userId,
        expires: row.expires,
      }
    },

    async deleteSession(sessionToken) {
      await pool.query(`DELETE FROM sessions WHERE "sessionToken" = $1`, [sessionToken])
    },

    // Additional methods that might be required
    async unlinkAccount({ providerAccountId, provider }) {
      await pool.query(
        `DELETE FROM accounts WHERE provider = $1 AND "providerAccountId" = $2`,
        [provider, providerAccountId]
      )
    },

    async deleteUser(userId) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId])
    },
  }
}


