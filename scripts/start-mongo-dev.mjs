// Starts the project's dedicated single-node MongoDB replica set on port
// 27027 if it isn't already running. See .env for why this instance exists
// (a Docker container on this machine permanently squats on the default
// 27017, so this project uses its own port + data directory instead).
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync } from "node:fs";

const PORT = 27027;
const MONGOD_PATH = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";
const DB_PATH = "C:\\Users\\Hp\\mongodb-dev\\yes-hotels-dev-data";
const LOG_PATH = "C:\\Users\\Hp\\mongodb-dev\\yes-hotels-dev.log";

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

const alreadyRunning = await isPortOpen(PORT);
if (alreadyRunning) {
  console.log(`[mongo-dev] already running on port ${PORT}`);
  process.exit(0);
}

if (process.platform !== "win32" || !existsSync(MONGOD_PATH)) {
  console.warn(
    `[mongo-dev] skipping auto-start: mongod not found at ${MONGOD_PATH}. ` +
      `Start it manually if you're not on this machine's setup.`,
  );
  process.exit(0);
}

console.log(`[mongo-dev] starting dedicated replica set on port ${PORT}...`);
const child = spawn(
  MONGOD_PATH,
  [
    "--port",
    String(PORT),
    "--dbpath",
    DB_PATH,
    "--replSet",
    "rs0",
    "--bind_ip",
    "127.0.0.1",
    "--logpath",
    LOG_PATH,
    "--logappend",
  ],
  { detached: true, stdio: "ignore" },
);
child.unref();

for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 500));
  if (await isPortOpen(PORT)) {
    console.log(`[mongo-dev] up on port ${PORT}`);
    process.exit(0);
  }
}

console.warn(`[mongo-dev] mongod did not come up within 15s, check ${LOG_PATH}`);
