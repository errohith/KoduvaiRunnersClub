import { randomUUID } from "node:crypto";
import { config } from "@/config/env";
import { logger } from "@/lib/logger";
import { hmacHex, safeEqual } from "@/lib/crypto";
import { ProviderError, classifyHttpFailure, fetchWithTimeout, joinUrl } from "../errors";
import type { WhatsAppAdapter, WhatsAppInbound, WhatsAppStatusUpdate, WhatsAppTemplateMessage } from "./types";

/** Development adapter: prints the message. It does NOT deliver anything. */
export const logWhatsAppAdapter: WhatsAppAdapter = {
  name: "log",
  async send(msg) {
    logger.info("whatsapp.log_adapter", { to: msg.to, template: msg.template.name, params: msg.template.params.length });
    return { providerMessageId: `log:${randomUUID()}` };
  },
};

/**
 * WhatsApp Business Platform — Cloud API.
 * POST {base}/{version}/{phone-number-id}/messages with a pre-approved template.
 * Business-initiated messages outside the 24h customer-service window MUST use approved
 * templates, so this adapter only sends templates. It cannot post to WhatsApp groups.
 */
export function createMetaCloudAdapter(opts: { baseUrl: string; version: string; phoneNumberId: string; accessToken: string; timeoutMs: number }): WhatsAppAdapter {
  return {
    name: "meta-cloud",
    async send(msg: WhatsAppTemplateMessage) {
      const res = await fetchWithTimeout(
        joinUrl(opts.baseUrl, opts.version, opts.phoneNumberId, "messages"),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: msg.to.replace(/^\+/, ""),
            type: "template",
            template: {
              name: msg.template.name,
              language: { code: msg.template.language },
              components: msg.template.params.length
                ? [{ type: "body", parameters: msg.template.params.map((text) => ({ type: "text", text: text.slice(0, 1024) })) }]
                : undefined,
            },
          }),
        },
        opts.timeoutMs,
      );
      const body = await res.text();
      if (!res.ok) {
        const err = classifyHttpFailure(res.status, body);
        // Cloud API throughput/rate-limit error codes are retryable even when returned as 400.
        if (/"code"\s*:\s*(130429|131056|80007|4|613)\b/.test(body)) throw new ProviderError(err.message, true, res.status);
        throw err;
      }
      try {
        const parsed = JSON.parse(body) as { messages?: { id: string }[] };
        return { providerMessageId: parsed.messages?.[0]?.id ?? null };
      } catch {
        return { providerMessageId: null };
      }
    },
  };
}

/** Verifies X-Hub-Signature-256: "sha256=<hex hmac of raw body with the app secret>". */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  return safeEqual(header.slice(7), hmacHex(appSecret, rawBody));
}

type MetaWebhook = {
  entry?: {
    changes?: {
      value?: {
        statuses?: { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string; code?: number }[] }[];
        messages?: { from: string; type: string; text?: { body: string }; button?: { text: string } }[];
      };
    }[];
  }[];
};

export function parseMetaWebhook(payload: unknown): { statuses: WhatsAppStatusUpdate[]; inbound: WhatsAppInbound[] } {
  const statuses: WhatsAppStatusUpdate[] = [];
  const inbound: WhatsAppInbound[] = [];
  for (const entry of (payload as MetaWebhook).entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        if (!["sent", "delivered", "read", "failed"].includes(s.status)) continue;
        statuses.push({
          providerMessageId: s.id,
          status: s.status as WhatsAppStatusUpdate["status"],
          error: s.errors?.map((e) => `${e.code ?? ""} ${e.title ?? e.message ?? ""}`.trim()).join("; "),
          timestamp: s.timestamp ? new Date(Number(s.timestamp) * 1000) : undefined,
        });
      }
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? "";
        inbound.push({ from: m.from.startsWith("+") ? m.from : `+${m.from}`, text });
      }
    }
  }
  return { statuses, inbound };
}

export const OPT_OUT_KEYWORDS = /^\s*(stop|unsubscribe|opt[\s-]?out|cancel)\s*$/i;
export const OPT_IN_KEYWORDS = /^\s*(start|subscribe|opt[\s-]?in)\s*$/i;

let override: WhatsAppAdapter | null = null;
export function setWhatsAppAdapterForTests(a: WhatsAppAdapter | null) {
  override = a;
}

export function getWhatsAppAdapter(): WhatsAppAdapter {
  if (override) return override;
  if (config.WHATSAPP_PROVIDER === "meta-cloud") {
    return createMetaCloudAdapter({
      baseUrl: config.WHATSAPP_API_BASE_URL,
      version: config.WHATSAPP_API_VERSION,
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID!,
      accessToken: config.WHATSAPP_ACCESS_TOKEN!,
      timeoutMs: config.NOTIFICATION_TIMEOUT_MS,
    });
  }
  return logWhatsAppAdapter;
}
