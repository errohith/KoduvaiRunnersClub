import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { config } from "@/config/env";
import { logger } from "@/lib/logger";
import { ProviderError, classifyHttpFailure, fetchWithTimeout, joinUrl } from "../errors";
import type { EmailAdapter, EmailMessage } from "./types";

const from = () => `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM_ADDRESS}>`;

/** Development adapter: prints the message. It does NOT deliver email. */
export const logEmailAdapter: EmailAdapter = {
  name: "log",
  async send(msg) {
    logger.info("email.log_adapter", { to: msg.to, subject: msg.subject, preview: msg.text.slice(0, 200) });
    return { providerMessageId: `log:${randomUUID()}` };
  },
};

/** Resend (or any API exposing the same POST /emails contract). */
export function createResendAdapter(opts: { baseUrl: string; apiKey: string; timeoutMs: number }): EmailAdapter {
  return {
    name: "resend",
    async send(msg: EmailMessage) {
      const res = await fetchWithTimeout(
        joinUrl(opts.baseUrl, "emails"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": msg.idempotencyKey.slice(0, 256),
          },
          body: JSON.stringify({
            from: from(),
            to: [msg.toName ? `${msg.toName.replace(/[<>"]/g, "")} <${msg.to}>` : msg.to],
            subject: msg.subject,
            text: msg.text,
            html: msg.html ?? undefined,
            reply_to: config.EMAIL_REPLY_TO,
            headers: msg.headers,
          }),
        },
        opts.timeoutMs,
      );
      const body = await res.text();
      if (!res.ok) throw classifyHttpFailure(res.status, body);
      try {
        return { providerMessageId: (JSON.parse(body) as { id?: string }).id ?? null };
      } catch {
        return { providerMessageId: null };
      }
    },
  };
}

export function createSmtpAdapter(opts: { url: string; timeoutMs: number }): EmailAdapter {
  const transport = nodemailer.createTransport(opts.url, { connectionTimeout: opts.timeoutMs, socketTimeout: opts.timeoutMs } as never);
  return {
    name: "smtp",
    async send(msg) {
      try {
        const info = await transport.sendMail({
          from: from(),
          to: msg.toName ? { name: msg.toName, address: msg.to } : msg.to,
          replyTo: config.EMAIL_REPLY_TO,
          subject: msg.subject,
          text: msg.text,
          html: msg.html ?? undefined,
          headers: msg.headers,
          messageId: undefined,
        });
        return { providerMessageId: info.messageId ?? null };
      } catch (e) {
        const err = e as { responseCode?: number; message: string };
        // 4xx SMTP replies are transient by definition; 5xx are permanent.
        const retryable = !err.responseCode || (err.responseCode >= 400 && err.responseCode < 500);
        throw new ProviderError(`SMTP: ${err.message}`, retryable, err.responseCode);
      }
    },
  };
}

let override: EmailAdapter | null = null;
/** Tests inject a mock adapter here. */
export function setEmailAdapterForTests(a: EmailAdapter | null) {
  override = a;
}

export function getEmailAdapter(): EmailAdapter {
  if (override) return override;
  switch (config.EMAIL_PROVIDER) {
    case "resend":
      return createResendAdapter({ baseUrl: config.EMAIL_API_BASE_URL, apiKey: config.EMAIL_API_KEY!, timeoutMs: config.NOTIFICATION_TIMEOUT_MS });
    case "smtp":
      return createSmtpAdapter({ url: config.EMAIL_SMTP_URL!, timeoutMs: config.NOTIFICATION_TIMEOUT_MS });
    default:
      return logEmailAdapter;
  }
}
