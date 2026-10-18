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
  console.error("UNHANDLED SERVER ERROR on", req.method, req.path, ":", err);
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

  // Client mistakes are answered as such, not as a server failure.
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "The request body is not valid JSON", requestId: req.id });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "The request is too large", requestId: req.id });
  }
  if (err?.name === "CastError" || err?.name === "BSONError") {
    return res.status(400).json({ success: false, message: "Invalid id or value in the request", requestId: req.id });
  }
  if (Number(err?.status) >= 400 && Number(err?.status) < 500) {
    return res.status(Number(err.status)).json({ success: false, message: err.expose ? err.message : "Bad request", requestId: req.id });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    requestId: req.id,
  });
}
