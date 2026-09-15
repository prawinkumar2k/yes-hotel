import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

// Optional, gitignored, machine-local override — lets a single developer's
// machine point TEST_MONGODB_URI somewhere other than the default without
// touching this shared file (which every other machine and CI still use
// unchanged, since the file simply won't exist for them). See .env.example
// for when/why this is needed.
dotenv.config({ path: path.resolve(__dirname, ".env.test.local"), quiet: true });

// Isolated from the development database on purpose: a failed test used to
// leak data into the real dev DB (confirmed during a manual QA pass — 28+
// orphaned test categories, 7 orphaned bookings, and other test artifacts
// were found sitting in the shared dev database). Tests now run against a
// dedicated database name so a failure can never touch real dev/demo data.
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";
process.env.NODE_ENV = "test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    setupFiles: ["./server/src/config/vitest.setup.ts"],
    // Test files run in separate module registries (each gets its own
    // in-memory job-handler Map, folio "current business date" state, etc.)
    // but they all point at the SAME real MongoDB test database — there is
    // no per-file DB namespace. That's fine for most specs (they scope their
    // own documents with unique stamps), but job-queue.service.spec.ts and
    // notificationRetry.job.spec.ts both call the real processNextJob(),
    // which — correctly, for production — claims the single globally
    // oldest-due job with no type filter. Run those two files concurrently
    // and one can steal the other's job: it finds no handler for a type it
    // never registered, silently resets that job back to PENDING, and the
    // owning test observes PENDING instead of the DEAD_LETTER/COMPLETED it
    // enqueued and expected. Reproduced directly: ~2 of 3 runs of these two
    // files together failed non-deterministically; either file alone always
    // passed. Fixed by serializing file execution rather than changing
    // processNextJob()'s claim semantics, which are correct for the real
    // single-process job queue this app runs.
    fileParallelism: false,
  },
});
