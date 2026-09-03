let warned = false;

/**
 * A hardcoded fallback secret is a critical vulnerability the moment this
 * app runs in production without JWT_ACCESS_SECRET set — anyone who can
 * read this source (or just guess the well-known default) can forge a
 * valid token for any user, including ADMIN. So: required in production,
 * a loudly-warned convenience fallback in development only.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_ACCESS_SECRET is not set. Refusing to start with an insecure default secret in production."
    );
  }

  if (!warned) {
    console.warn(
      "⚠️  JWT_ACCESS_SECRET is not set — using an insecure development-only default. " +
        "Set JWT_ACCESS_SECRET before deploying to production."
    );
    warned = true;
  }
  return "insecure-development-only-default-secret";
}
