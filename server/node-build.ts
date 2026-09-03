import path from "node:path";
import mongoose from "mongoose";
import { createServer } from "./index";
import * as express from "express";
import { logger } from "./src/services/logger.service";
import { stopJobWorker } from "./src/services/job-queue.service";

const app = createServer();
const port = process.env.PORT || 3000;

// In production, serve the built SPA files
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

// Serve static files
app.use(express.static(distPath));

// Handle React Router - serve index.html for all non-API routes
//
// Express 5 (path-to-regexp v8) rejects a bare "*" wildcard route — it
// requires a named wildcard segment. This was undetected all session
// because dev mode never runs this file at all (vite.config.ts's
// expressPlugin only calls createServer(), never node-build.ts); it only
// executes in the actual compiled production entrypoint, which crashed on
// boot before ever reaching app.listen(). Found via an isolated
// `pnpm install --prod` + real `node dist/server/node-build.mjs` boot test.
app.get("/*splat", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

const server = app.listen(port, () => {
  logger.info("server_started", { port });
});

// Real graceful shutdown: stop accepting new connections, let in-flight
// requests (e.g. a booking transaction, a payment verification) finish,
// then close the database connection before exiting. The previous version
// of this handler called process.exit(0) immediately, which could cut off
// an in-flight booking or payment mid-request.
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("shutdown_initiated", { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error("shutdown_timed_out", { timeoutMs: 10000 });
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) {
      logger.error("shutdown_http_close_error", { message: err.message });
    } else {
      logger.info("shutdown_http_closed", {});
    }
    stopJobWorker();
    logger.info("shutdown_job_worker_stopped", {});
    try {
      await mongoose.connection.close();
      logger.info("shutdown_db_closed", {});
    } catch (dbErr: any) {
      logger.error("shutdown_db_close_error", { message: dbErr?.message });
    }
    clearTimeout(forceExitTimer);
    process.exit(err ? 1 : 0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
