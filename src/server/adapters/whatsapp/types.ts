export type WhatsAppTemplateMessage = {
  /** E.164, e.g. +919876543210 */
  to: string;
  template: { name: string; language: string; params: string[] };
  idempotencyKey: string;
};

export type WhatsAppStatusUpdate = {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  error?: string;
  timestamp?: Date;
};

export type WhatsAppInbound = { from: string; text: string };

export interface WhatsAppAdapter {
  readonly name: string;
  send(msg: WhatsAppTemplateMessage): Promise<{ providerMessageId: string | null }>;
}
