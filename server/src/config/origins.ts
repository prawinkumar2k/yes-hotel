/**
 * Browser origins allowed to call the API and live chat: CLIENT_URL plus its www / non-www twin
 * (yeshotels.in and www.yeshotels.in), plus any extra origins in EXTRA_ORIGINS (comma-separated).
 */
export function allowedOrigins(): string[] {
  const base = (process.env.CLIENT_URL || "http://localhost:8080").replace(/\/$/, "");
  const out = new Set<string>([base]);
  try {
    const u = new URL(base);
    const twin = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && u.hostname !== "localhost") out.add(`${u.protocol}//${twin}${u.port ? `:${u.port}` : ""}`);
  } catch { /* CLIENT_URL not a URL: keep it as given */ }
  for (const o of (process.env.EXTRA_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean)) out.add(o);
  return [...out];
}
