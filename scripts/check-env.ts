/** Validate .env without starting the app: `npm run env:check` */
import "dotenv/config";
import { parseConfig, ConfigError } from "../src/config/env";

try {
  const c = parseConfig(process.env);
  console.log("✓ Configuration is valid");
  console.log(`  APP_ENV=${c.APP_ENV}  APP_URL=${c.APP_URL}  TZ=${c.APP_TIMEZONE}`);
  console.log(`  Email: ${c.EMAIL_ENABLED ? c.EMAIL_PROVIDER : "disabled"} · WhatsApp: ${c.WHATSAPP_ENABLED ? c.WHATSAPP_PROVIDER : "disabled"} · Payments: ${c.PAYMENT_ENABLED ? c.PAYMENT_PROVIDER : "disabled"} · Storage: ${c.STORAGE_PROVIDER}`);
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
