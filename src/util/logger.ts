// Tiny leveled console logger with scope tags + secret redaction. No external deps.

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
const MIN = ORDER[envLevel] ?? ORDER.info;

// Redact bearer tokens and key/secret/token-like values from anything we log.
function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1***")
      .replace(/(EAA[A-Za-z0-9]{6})[A-Za-z0-9]+/g, "$1***") // Meta tokens
      .replace(/(rzp_(?:test|live)_)[A-Za-z0-9]+/g, "$1***");
  }
  return value;
}

function emit(level: Level, scope: string, msg: string, extra?: unknown) {
  if (ORDER[level] < MIN) return;
  const ts = new Date().toISOString();
  const line = `${ts} ${level.toUpperCase().padEnd(5)} [${scope}] ${redact(msg)}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (extra !== undefined) fn(line, redact(typeof extra === "string" ? extra : JSON.stringify(extra)));
  else fn(line);
}

export interface Logger {
  debug(msg: string, extra?: unknown): void;
  info(msg: string, extra?: unknown): void;
  warn(msg: string, extra?: unknown): void;
  error(msg: string, extra?: unknown): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, e) => emit("debug", scope, m, e),
    info: (m, e) => emit("info", scope, m, e),
    warn: (m, e) => emit("warn", scope, m, e),
    error: (m, e) => emit("error", scope, m, e),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

export const log = createLogger("app");
