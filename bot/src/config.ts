import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOT_ROOT = join(__dirname, "..");

/** Load bot/.env if present (simple KEY=VALUE, no export). */
function loadDotEnv(): void {
  const path = join(BOT_ROOT, ".env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

export type AnalysisLevel = "safe" | "regular" | "risky";

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

function envLevel(raw: string | undefined): AnalysisLevel {
  if (raw === "safe" || raw === "regular" || raw === "risky") return raw;
  return "regular";
}

export const config = {
  apiBase: (process.env.BOT_API_BASE ?? "http://localhost:5099").replace(/\/$/, ""),
  symbol: (process.env.BOT_SYMBOL ?? "NVDA").toUpperCase(),
  level: envLevel(process.env.BOT_LEVEL),
  dryRun: envBool("BOT_DRY_RUN", true),
  pollMs: Number(process.env.BOT_POLL_MS ?? 5000) || 5000,
  dataDir: join(BOT_ROOT, "data"),
  botRoot: BOT_ROOT,
} as const;
