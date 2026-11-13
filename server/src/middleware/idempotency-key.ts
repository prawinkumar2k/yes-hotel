import type { Request, Response, NextFunction } from "express";

/**
 * Duplicate-submit protection for create endpoints (e.g. walk-in registration).
 * The client sends an `Idempotency-Key` header, generated once per form. The same key arriving again:
 *   - while the first request is still running  -> 409 (tell the user to wait)
 *   - after the first one succeeded             -> the first response is replayed, nothing is created twice
 *   - after the first one failed                -> allowed to try again
 * No header = no protection (older clients keep working). Kept in memory: the app runs as one process.
 */
type Entry = { state: "RUNNING" | "DONE"; status?: number; body?: unknown; at: number };
const store = new Map<string, Entry>();
const TTL_MS = 10 * 60 * 1000;

function sweep(now: number) {
  for (const [k, v] of store) if (now - v.at > TTL_MS) store.delete(k);
}

export function idempotencyKey(req: Request, res: Response, next: NextFunction) {
  const raw = req.header("Idempotency-Key");
  if (!raw || raw.length > 100) return next();
  const now = Date.now();
  sweep(now);
  const key = `${req.method}:${req.baseUrl}${req.path}:${(req as any).user?.id ?? ""}:${raw}`;
  const seen = store.get(key);

  if (seen?.state === "RUNNING") {
    return res.status(409).json({ success: false, message: "This request is already being processed. Please wait a moment." });
  }
  if (seen?.state === "DONE") {
    res.setHeader("Idempotent-Replay", "true");
    return res.status(seen.status ?? 200).json(seen.body);
  }

  store.set(key, { state: "RUNNING", at: now });
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) store.set(key, { state: "DONE", status: res.statusCode, body, at: Date.now() });
    else store.delete(key); // failed: the user may correct the form and retry
    return json(body);
  };
  res.on("close", () => { if (store.get(key)?.state === "RUNNING") store.delete(key); });
  next();
}

export function _resetIdempotencyStore() { store.clear(); }
