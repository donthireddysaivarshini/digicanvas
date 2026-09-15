type LogLevel = "debug" | "info" | "warn" | "error";

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "sessiontoken",
  "session_token",
  "auth_secret",
  "secret",
  "authorization",
  "cookie",
]);

function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function formatLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const sanitizedContext = context ? sanitizeLogData(context) : undefined;
  
  const entry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(sanitizedContext ? { context: sanitizedContext } : {}),
  };

  return JSON.stringify(entry);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog("debug", message, context));
    }
  },
  info: (message: string, context?: Record<string, unknown>) => {
    console.info(formatLog("info", message, context));
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(formatLog("warn", message, context));
  },
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    const errorDetails = error instanceof Error
      ? { errorMessage: error.message, stack: error.stack }
      : { error };

    console.error(formatLog("error", message, { ...errorDetails, ...context }));
  },
};
