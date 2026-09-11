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
  },
});
