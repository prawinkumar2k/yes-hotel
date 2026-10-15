// Prints the MASTER_PASSWORD_HASH value for the server environment.
//   node scripts/make-master-password-hash.mjs "the master password"
// Put the printed line in the server's .env (never commit it). Only this hash is stored anywhere.
import crypto from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: node scripts/make-master-password-hash.mjs "<master password, 12+ characters>"');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 32);
console.log(`MASTER_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
