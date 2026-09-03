import { Request, Response, NextFunction } from "express";
import { logger } from "../services/logger.service";

/**
 * Last-resort safety net for anything that throws and isn't caught by a
 * controller's own try/catch (every controller in this codebase has one,
 * but a bug in shared middleware, or a future controller that forgets one,
 * would otherwise crash the process or hang the request with no response).
 * Must be registered LAST, after every route.
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error("unhandled_error", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    message: err?.message,
    // Stack traces can be genuinely useful for debugging but must never
    // reach the client response (file paths, internals) — logged only,
    // and only outside production noise-reduction isn't the goal here,
    // it's simply not part of the client-facing payload below.
    stack: err?.stack,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    requestId: req.id,
  });
}
