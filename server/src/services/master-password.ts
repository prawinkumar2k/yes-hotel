/**
 * Owner's master password (break-glass): lets the hotel owner sign in to any STAFF account even
 * after that person changed their password. Owner-requested, with safeguards:
 *   - only a scrypt hash lives in the server environment (MASTER_PASSWORD_HASH="scrypt:<salt>:<hash>");
 *     the password itself is never in the code, the database or backups;
 *   - unset = feature off;
 *   - staff accounts only (never CUSTOMER), never disabled accounts;
 *   - every use is written to the audit log (auth.master_password_login) by the login handler;
 *   - same rate limit as any login attempt.
 * Generate a hash with: node scripts/make-master-password-hash.mjs "<password>"
 */
import crypto from "node:crypto";

export function isMasterPassword(candidate: string): boolean {
  const stored = process.env.MASTER_PASSWORD_HASH || "";
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex || typeof candidate !== "string" || !candidate) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(candidate, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length > 0 && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
