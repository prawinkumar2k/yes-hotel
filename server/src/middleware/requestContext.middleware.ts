import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../services/logger.service";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Assigns a correlation id to every request — reused from an upstream
 * proxy/load balancer's `x-request-id` header when present (so a trace
 * stays consistent across the whole chain), generated fresh otherwise.
 * Echoed back as `X-Request-Id` so a client (or a support ticket quoting a
 * failed request) can be matched to the exact server-side log lines.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  req.id = typeof incoming === "string" && incoming.trim() ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

/**
 * One structured JSON log line per completed request: method, route,
 * status, duration, requestId, and (when authenticated) the actor's user id
 * and role — never the request/response body, which is exactly where a
 * password or token could leak. Logged on `res.on("finish")` so the actual
 * final status code is captured, including ones set deep in error handlers.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const user = (req as any).user;
    logger.info("http_request", {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: user?.id,
      userRole: user?.role,
    });
  });
  next();
}
