/**
 * Centralised configuration. This is the ONLY module that reads process.env.
 * Everything else imports `config` from here. Server-only: never import from a
 * client component (the `server-only`-style guard below throws in the browser).
 */
import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("src/config/env.ts must never be imported into client-side code.");
}

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? def : ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())));

const optionalStr = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

const int = (def: number, min = 0) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v.trim() === "") return def;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `must be an integer >= ${min}` });
        return z.NEVER;
      }
      return n;
    });

const url = z.string().trim().url();

export const envSchema = z
  .object({
    APP_NAME: z.string().trim().min(1).default("Koduvai Runners"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_URL: url,
    APP_TIMEZONE: z
      .string()
      .default("Asia/Kolkata")
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "must be a valid IANA timezone, e.g. Asia/Kolkata"),
    PORT: int(3000, 1),
    CORS_ALLOWED_ORIGINS: csv,
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    CRON_SECRET: optionalStr,

    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgresql:// connection string"),
    DIRECT_DATABASE_URL: optionalStr,

    AUTH_SECRET: z.string().min(32, "must be at least 32 characters (openssl rand -hex 32)"),
    SESSION_TTL_HOURS: int(12, 1),
    ADMIN_BOOTSTRAP_ENABLED: bool(false),
    ADMIN_BOOTSTRAP_EMAIL: optionalStr,
    ADMIN_BOOTSTRAP_PASSWORD: optionalStr,

    EMAIL_ENABLED: bool(false),
    EMAIL_PROVIDER: z.enum(["log", "resend", "smtp"]).default("log"),
    EMAIL_API_BASE_URL: z.string().trim().default("https://api.resend.com"),
    EMAIL_API_KEY: optionalStr,
    EMAIL_SMTP_URL: optionalStr,
    EMAIL_FROM_ADDRESS: z.string().trim().email().default("no-reply@example.org"),
    EMAIL_FROM_NAME: z.string().trim().default("Koduvai Runners"),
    EMAIL_REPLY_TO: optionalStr,
    EMAIL_WEBHOOK_SECRET: optionalStr,

    WHATSAPP_ENABLED: bool(false),
    WHATSAPP_PROVIDER: z.enum(["log", "meta-cloud"]).default("log"),
    WHATSAPP_API_BASE_URL: z.string().trim().default("https://graph.facebook.com"),
    WHATSAPP_API_VERSION: z.string().trim().default("v21.0"),
    WHATSAPP_PHONE_NUMBER_ID: optionalStr,
    WHATSAPP_BUSINESS_ACCOUNT_ID: optionalStr,
    WHATSAPP_ACCESS_TOKEN: optionalStr,
    WHATSAPP_APP_SECRET: optionalStr,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalStr,

    PAYMENT_ENABLED: bool(false),
    PAYMENT_PROVIDER: z.enum(["none", "razorpay", "mock"]).default("none"),
    PAYMENT_API_BASE_URL: z.string().trim().default("https://api.razorpay.com"),
    PAYMENT_API_KEY_ID: optionalStr,
    PAYMENT_API_KEY_SECRET: optionalStr,
    PAYMENT_WEBHOOK_SECRET: optionalStr,
    PAYMENT_CURRENCY: z.string().trim().length(3).toUpperCase().default("INR"),

    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().trim().default("./uploads"),
    STORAGE_ENDPOINT: optionalStr,
    STORAGE_BUCKET: optionalStr,
    STORAGE_REGION: z.string().trim().default("auto"),
    STORAGE_ACCESS_KEY: optionalStr,
    STORAGE_SECRET_KEY: optionalStr,
    STORAGE_PUBLIC_BASE_URL: optionalStr,
    UPLOAD_MAX_MB: int(5, 1),

    CLUB_ADMIN_EMAIL: csv,
    CLUB_ADMIN_WHATSAPP: csv,
    MEMBER_ANNOUNCEMENTS_ENABLED: bool(true),
    NOTIFICATION_RETRY_LIMIT: int(5, 0),
    NOTIFICATION_TIMEOUT_MS: int(10000, 100),
    WORKER_POLL_INTERVAL_MS: int(5000, 250),
  })
  .superRefine((e, ctx) => {
    const need = (cond: boolean, key: string, why: string) => {
      if (cond) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `required ${why}` });
    };
    need(e.ADMIN_BOOTSTRAP_ENABLED && !e.ADMIN_BOOTSTRAP_EMAIL, "ADMIN_BOOTSTRAP_EMAIL", "when ADMIN_BOOTSTRAP_ENABLED=true");
    need(
      e.ADMIN_BOOTSTRAP_ENABLED && (e.ADMIN_BOOTSTRAP_PASSWORD?.length ?? 0) < 12,
      "ADMIN_BOOTSTRAP_PASSWORD",
      "(min 12 characters) when ADMIN_BOOTSTRAP_ENABLED=true",
    );

    if (e.EMAIL_ENABLED) {
      need(e.EMAIL_PROVIDER === "resend" && !e.EMAIL_API_KEY, "EMAIL_API_KEY", "when EMAIL_PROVIDER=resend");
      need(e.EMAIL_PROVIDER === "smtp" && !e.EMAIL_SMTP_URL, "EMAIL_SMTP_URL", "when EMAIL_PROVIDER=smtp");
      need(e.EMAIL_PROVIDER === "log" && e.APP_ENV === "production", "EMAIL_PROVIDER", "to be a real provider in production (log does not send)");
    }
    if (e.WHATSAPP_ENABLED && e.WHATSAPP_PROVIDER === "meta-cloud") {
      need(!e.WHATSAPP_PHONE_NUMBER_ID, "WHATSAPP_PHONE_NUMBER_ID", "when WHATSAPP_PROVIDER=meta-cloud");
      need(!e.WHATSAPP_ACCESS_TOKEN, "WHATSAPP_ACCESS_TOKEN", "when WHATSAPP_PROVIDER=meta-cloud");
      need(!e.WHATSAPP_APP_SECRET, "WHATSAPP_APP_SECRET", "to verify webhook signatures");
      need(!e.WHATSAPP_WEBHOOK_VERIFY_TOKEN, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "for webhook subscription");
    }
    if (e.WHATSAPP_ENABLED && e.WHATSAPP_PROVIDER === "log" && e.APP_ENV === "production") {
      need(true, "WHATSAPP_PROVIDER", "to be meta-cloud in production (log does not send)");
    }
    if (e.PAYMENT_ENABLED) {
      need(e.PAYMENT_PROVIDER === "none", "PAYMENT_PROVIDER", "when PAYMENT_ENABLED=true");
      need(e.PAYMENT_PROVIDER === "mock" && e.APP_ENV === "production", "PAYMENT_PROVIDER", "to be a real provider in production (mock is for development only)");
      need(!e.PAYMENT_WEBHOOK_SECRET, "PAYMENT_WEBHOOK_SECRET", "when PAYMENT_ENABLED=true");
      need(e.PAYMENT_PROVIDER === "razorpay" && (!e.PAYMENT_API_KEY_ID || !e.PAYMENT_API_KEY_SECRET), "PAYMENT_API_KEY_ID", "and PAYMENT_API_KEY_SECRET when PAYMENT_PROVIDER=razorpay");
    }
    if (e.STORAGE_PROVIDER === "s3") {
      for (const k of ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY", "STORAGE_PUBLIC_BASE_URL"] as const) {
        need(!e[k], k, "when STORAGE_PROVIDER=s3");
      }
    }
    if (e.APP_ENV === "production") {
      need(!e.APP_URL.startsWith("https://"), "APP_URL", "to use https:// in production");
      need(!e.CRON_SECRET || e.CRON_SECRET.length < 24, "CRON_SECRET", "(min 24 characters) in production");
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      "Invalid configuration — fix these values in your .env file (see .env.example):\n" +
        issues.map((i) => `  • ${i}`).join("\n"),
    );
    this.name = "ConfigError";
  }
}

export function parseConfig(source: Record<string, string | undefined>): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  return result.data;
}

let cached: AppConfig | undefined;

/** Lazily validated so `next build` can run without production secrets present. */
export function getConfig(): AppConfig {
  if (!cached) cached = parseConfig(process.env);
  return cached;
}

/** Test helper — reset after mutating process.env. */
export function resetConfigForTests() {
  cached = undefined;
}

export const config = new Proxy({} as AppConfig, {
  get: (_t, prop: string) => getConfig()[prop as keyof AppConfig],
});
