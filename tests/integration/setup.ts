import { afterEach } from "vitest";
import { testEnv } from "./env";

Object.assign(process.env, testEnv());

afterEach(async () => {
  const { setEmailAdapterForTests } = await import("@/server/adapters/email");
  const { setWhatsAppAdapterForTests } = await import("@/server/adapters/whatsapp");
  const { setPaymentAdapterForTests } = await import("@/server/adapters/payment");
  setEmailAdapterForTests(null);
  setWhatsAppAdapterForTests(null);
  setPaymentAdapterForTests(null);
});
