import crypto from "crypto";
import { RefreshToken } from "../models/RefreshToken";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateRawToken() {
  return crypto.randomBytes(48).toString("hex");
}

/**
 * Issues a brand-new refresh token family (used at login). Returns the raw
 * token — only its hash is ever persisted.
 */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = generateRawToken();
  const family = crypto.randomUUID();
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(raw),
    family,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return raw;
}

export class RefreshTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshTokenError";
  }
}

/**
 * Rotates a refresh token: validates it, revokes it, and issues a new one
 * in the same family. If the presented token was already revoked/rotated
 * (reuse of a stale token — the strongest practical signal of theft, since
 * a legitimate client only ever holds the newest token in its family), the
 * entire family is revoked and the caller must re-authenticate.
 */
export async function rotateRefreshToken(
  rawToken: string
): Promise<{ userId: string; newRawToken: string }> {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing) {
    throw new RefreshTokenError("Invalid refresh token");
  }

  if (existing.expiresAt < new Date()) {
    throw new RefreshTokenError("Refresh token expired");
  }

  if (existing.revokedAt) {
    // Reuse of an already-rotated/revoked token — treat as compromised and
    // kill the whole lineage.
    await RefreshToken.updateMany(
      { family: existing.family, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
    throw new RefreshTokenError("Refresh token reuse detected — all sessions in this lineage revoked");
  }

  const newRaw = generateRawToken();
  const newHash = hashToken(newRaw);

  existing.revokedAt = new Date();
  existing.replacedByHash = newHash;
  await existing.save();

  await RefreshToken.create({
    user: existing.user,
    tokenHash: newHash,
    family: existing.family,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { userId: existing.user.toString(), newRawToken: newRaw };
}

/** Revokes a single refresh token (logout). */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}

/** Revokes every refresh token for a user (password reset, security event). */
export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}
