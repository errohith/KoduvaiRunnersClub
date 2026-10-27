import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig } from "@/config/env";

const ok = { APP_URL: "http://localhost:3000", DATABASE_URL: "postgresql://u:p@localhost:5432/db", AUTH_SECRET: "x".repeat(32) };
const issues = (env: Record<string, string>) => {
  try {
    parseConfig(env);
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as ConfigError).issues;
  }
};

describe("environment validation", () => {
  it("accepts a minimal development config with safe defaults", () => {
    const c = parseConfig(ok);
    expect(c.PAYMENT_ENABLED).toBe(false);
    expect(c.EMAIL_ENABLED).toBe(false);
    expect(c.PAYMENT_CURRENCY).toBe("INR");
    expect(c.APP_TIMEZONE).toBe("Asia/Kolkata");
  });
  it("reports every missing required value with an actionable message", () => {
    const list = issues({});
    expect(list.join("\n")).toMatch(/APP_URL/);
    expect(list.join("\n")).toMatch(/DATABASE_URL/);
    expect(list.join("\n")).toMatch(/AUTH_SECRET/);
  });
  it("rejects short secrets, bad timezones and non-postgres URLs", () => {
    expect(issues({ ...ok, AUTH_SECRET: "short" }).join()).toMatch(/AUTH_SECRET/);
    expect(issues({ ...ok, APP_TIMEZONE: "Mars/Olympus" }).join()).toMatch(/APP_TIMEZONE/);
    expect(issues({ ...ok, DATABASE_URL: "mysql://x" }).join()).toMatch(/DATABASE_URL/);
  });
  it("requires provider credentials only when a channel is enabled", () => {
    expect(issues({ ...ok, EMAIL_ENABLED: "true", EMAIL_PROVIDER: "resend" }).join()).toMatch(/EMAIL_API_KEY/);
    expect(issues({ ...ok, WHATSAPP_ENABLED: "true", WHATSAPP_PROVIDER: "meta-cloud" }).join()).toMatch(/WHATSAPP_ACCESS_TOKEN/);
    expect(issues({ ...ok, EMAIL_PROVIDER: "resend" })).toEqual([]);
  });
  it("requires a webhook secret and a provider before payments can be enabled", () => {
    const list = issues({ ...ok, PAYMENT_ENABLED: "true" }).join();
    expect(list).toMatch(/PAYMENT_PROVIDER/);
    expect(list).toMatch(/PAYMENT_WEBHOOK_SECRET/);
  });
  it("refuses development-only providers and plain http in production", () => {
    const list = issues({ ...ok, APP_ENV: "production", PAYMENT_ENABLED: "true", PAYMENT_PROVIDER: "mock", PAYMENT_WEBHOOK_SECRET: "s", EMAIL_ENABLED: "true", EMAIL_PROVIDER: "log" }).join();
    expect(list).toMatch(/mock is for development only/);
    expect(list).toMatch(/log does not send/);
    expect(list).toMatch(/APP_URL/);
    expect(list).toMatch(/CRON_SECRET/);
  });
});
