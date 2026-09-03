/**
 * Minimal structured JSON logger. Not a full logging framework (no pino/winston
 * dependency added for this) — every log line is a single JSON object to
 * stdout/stderr, which is what actually matters for production: any log
 * aggregator (CloudWatch, Datadog, a platform's own log viewer) can parse
 * JSON lines directly, where free-form `console.log("some string")` cannot
 * be queried/filtered/correlated at all.
 *
 * Fields that must NEVER appear in a log line: passwords, JWTs/refresh
 * tokens, Razorpay key secrets/webhook secrets, full payment signatures, or
 * raw request/response bodies for auth and payment routes (which could
 * contain any of the above). Every call site in this codebase logs
 * specific, named fields — never `console.log(req.body)` — so there is no
 * single central redaction step to bypass; new call sites must keep that
 * discipline.
 */
type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, fields?: Record<string, unknown>) {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("error", message, fields),
};
