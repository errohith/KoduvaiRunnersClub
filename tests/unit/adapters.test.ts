import { afterEach, describe, expect, it, vi } from "vitest";
import { createResendAdapter } from "@/server/adapters/email";
import { createMetaCloudAdapter, parseMetaWebhook, verifyMetaSignature, OPT_OUT_KEYWORDS } from "@/server/adapters/whatsapp";
import { createRazorpayAdapter, createMockAdapter, disabledPaymentAdapter } from "@/server/adapters/payment";
import { ProviderError } from "@/server/adapters/errors";
import { hmacHex } from "@/lib/crypto";

afterEach(() => vi.unstubAllGlobals());
const respond = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

describe("email adapter (Resend-compatible)", () => {
  const adapter = createResendAdapter({ baseUrl: "https://email.test/", apiKey: "k", timeoutMs: 50 });
  const msg = { to: "a@b.co", subject: "S", text: "T", idempotencyKey: "idem-1" };

  it("sends to the configured base URL with an idempotency key", async () => {
    const f = respond(200, { id: "msg_1" });
    vi.stubGlobal("fetch", f);
    await expect(adapter.send(msg)).resolves.toEqual({ providerMessageId: "msg_1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://email.test/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-1");
  });
  it("marks 5xx and 429 as retryable, 4xx as permanent", async () => {
    vi.stubGlobal("fetch", respond(503, "down"));
    await expect(adapter.send(msg)).rejects.toMatchObject({ retryable: true, status: 503 });
    vi.stubGlobal("fetch", respond(429, "slow down"));
    await expect(adapter.send(msg)).rejects.toMatchObject({ retryable: true });
    vi.stubGlobal("fetch", respond(422, "bad sender"));
    await expect(adapter.send(msg)).rejects.toMatchObject({ retryable: false });
  });
  it("treats timeouts and network errors as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }));
    const err = await adapter.send(msg).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.retryable).toBe(true);
  });
});

describe("WhatsApp Cloud API adapter", () => {
  const adapter = createMetaCloudAdapter({ baseUrl: "https://graph.test", version: "v21.0", phoneNumberId: "123", accessToken: "tok", timeoutMs: 100 });
  it("sends an approved template with ordered body parameters", async () => {
    const f = respond(200, { messages: [{ id: "wamid.1" }] });
    vi.stubGlobal("fetch", f);
    const r = await adapter.send({ to: "+919876543210", template: { name: "reg_confirmed", language: "en", params: ["Asha", "10K"] }, idempotencyKey: "x" });
    expect(r.providerMessageId).toBe("wamid.1");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.test/v21.0/123/messages");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ messaging_product: "whatsapp", to: "919876543210", type: "template", template: { name: "reg_confirmed", language: { code: "en" } } });
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(["Asha", "10K"]);
  });
  it("retries on throughput limits even when returned as HTTP 400", async () => {
    vi.stubGlobal("fetch", respond(400, { error: { code: 130429, message: "Rate limit hit" } }));
    await expect(adapter.send({ to: "+91", template: { name: "t", language: "en", params: [] }, idempotencyKey: "x" })).rejects.toMatchObject({ retryable: true });
  });
  it("verifies X-Hub-Signature-256 and parses statuses and STOP replies", () => {
    const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "delivered", timestamp: "1700000000" }], messages: [{ from: "919876543210", type: "text", text: { body: "STOP" } }] } }] }] });
    expect(verifyMetaSignature(body, `sha256=${hmacHex("app-secret", body)}`, "app-secret")).toBe(true);
    expect(verifyMetaSignature(body, `sha256=${hmacHex("other", body)}`, "app-secret")).toBe(false);
    expect(verifyMetaSignature(body, null, "app-secret")).toBe(false);
    const parsed = parseMetaWebhook(JSON.parse(body));
    expect(parsed.statuses[0]).toMatchObject({ providerMessageId: "wamid.1", status: "delivered" });
    expect(parsed.inbound[0]).toEqual({ from: "+919876543210", text: "STOP" });
    expect(OPT_OUT_KEYWORDS.test(parsed.inbound[0].text)).toBe(true);
  });
});

describe("payment adapters", () => {
  it("disabled adapter never creates checkouts", async () => {
    expect(disabledPaymentAdapter.enabled).toBe(false);
    await expect(disabledPaymentAdapter.createCheckout({} as never)).rejects.toMatchObject({ code: "payments_disabled" });
    expect(disabledPaymentAdapter.verifyWebhook("{}", new Headers())).toBe(false);
  });
  it("Razorpay webhook signatures are verified on the raw body", () => {
    const rp = createRazorpayAdapter({ baseUrl: "https://rp.test", keyId: "k", keySecret: "s", webhookSecret: "whsec", timeoutMs: 100 });
    const raw = JSON.stringify({ event: "payment_link.paid", payload: { payment_link: { entity: { id: "plink_1", reference_id: "KR-PAY-2026-000001" } }, payment: { entity: { id: "pay_1", amount: 50000 } } } });
    expect(rp.verifyWebhook(raw, new Headers({ "x-razorpay-signature": hmacHex("whsec", raw) }))).toBe(true);
    expect(rp.verifyWebhook(raw + " ", new Headers({ "x-razorpay-signature": hmacHex("whsec", raw) }))).toBe(false);
    expect(rp.verifyWebhook(raw, new Headers())).toBe(false);
    const evt = rp.parseWebhook(raw, new Headers({ "x-razorpay-event-id": "evt_1" }));
    expect(evt).toMatchObject({ eventId: "evt_1", type: "payment.succeeded", reference: "KR-PAY-2026-000001", providerPaymentId: "pay_1", amountMinor: 50000 });
  });
  it("mock provider verifies HMAC signatures", () => {
    const m = createMockAdapter({ appUrl: "http://x", webhookSecret: "sec" });
    const raw = JSON.stringify({ id: "e1", type: "payment.succeeded", reference: "R" });
    expect(m.verifyWebhook(raw, new Headers({ "x-mock-signature": hmacHex("sec", raw) }))).toBe(true);
    expect(m.verifyWebhook(raw, new Headers({ "x-mock-signature": "deadbeef" }))).toBe(false);
  });
});
