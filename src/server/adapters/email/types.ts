export type EmailMessage = {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  idempotencyKey: string;
  headers?: Record<string, string>;
};

export interface EmailAdapter {
  readonly name: string;
  /** Resolves with the provider's message id once the provider has ACCEPTED the message. Throws ProviderError. */
  send(msg: EmailMessage): Promise<{ providerMessageId: string | null }>;
}
