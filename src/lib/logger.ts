/** Minimal structured logger. Redacts anything that looks like a secret or personal contact data. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
const SENSITIVE = /pass(word)?|secret|token|authorization|api[_-]?key|cvv|card|medical|emergency/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  );
}

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const min = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;
  if (LEVELS[level] < min) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(meta ? (redact(meta) as object) : {}) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log("error", m, meta),
};
