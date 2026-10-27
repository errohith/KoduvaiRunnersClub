# External integrations: status and activation

**Nothing external has been called against a real provider.** Every adapter is implemented against the provider's documented contract and tested with mocks. Verify each against the provider's *current* documentation and a sandbox account before going live.

| Integration | Status | What is needed to activate |
|---|---|---|
| Email | Adapters: `log` (dev), `resend` (Resend-compatible HTTP API), `smtp` (any SMTP server). **Disabled** (`EMAIL_ENABLED=false`). | A provider account with a **verified sending domain**, then the steps below. |
| WhatsApp | Adapter: `meta-cloud` (WhatsApp Business Platform Cloud API). **Disabled.** No template names are configured, so WhatsApp sends are recorded as *skipped*. | A Meta Business account, WhatsApp Business phone number, system-user token, app secret and **approved message templates**. |
| Payments | Adapters: `razorpay` (Payment Links) and `mock` (dev only). **Disabled** (`PAYMENT_ENABLED=false`). | A Razorpay account (or another provider plus a new adapter), API keys and a webhook secret. |
| Storage | `local` (default, `./uploads`) and `s3` (any S3-compatible store). | For multiple app servers or serverless hosting, use `s3`. |
| Email delivery callbacks | Generic endpoint `/api/v1/webhooks/email` with a shared secret. | Provider-specific signed payloads (e.g. Resend/Svix) need a small relay or adapter. Not built. |
| Provider refunds | Admins **record** refunds; there is no refund API call. | Implement `refund()` on the payment adapter if automated refunds are wanted. |

## Email

1. Verify your sending domain with the provider (SPF, DKIM, DMARC).
2. In `.env`:
   - Resend: `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY=…`, `EMAIL_API_BASE_URL=https://api.resend.com`
   - SMTP (e.g. Google Workspace, Zoho, SES SMTP): `EMAIL_PROVIDER=smtp`, `EMAIL_SMTP_URL=smtps://user:pass@smtp.example.com:465`
   - `EMAIL_FROM_ADDRESS` must be on the verified domain. Then set `EMAIL_ENABLED=true`.
3. Restart the web process **and** the worker. Run `npm run env:check`.
4. Admin → Templates → any email template → **Send test**. The flash message shows the provider response.

## WhatsApp (Cloud API)

1. In Meta Business Manager, create the app, add WhatsApp, register the phone number, and create a **system user** with a permanent token (`whatsapp_business_messaging` permission).
2. Create message templates in WhatsApp Manager. Each template in **Admin → Templates (WhatsApp)** lists its variables in order, e.g. `{{1}}=name, {{2}}=eventTitle`. For announcements, create one template whose body uses `{{1}}` = recipient name and `{{2}}` = message text.
3. After approval, enter each **template name** and **language** on the matching WhatsApp template in the admin.
4. `.env`: `WHATSAPP_ENABLED=true`, `WHATSAPP_PROVIDER=meta-cloud`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any random string). `WHATSAPP_API_VERSION` defaults to `v21.0`; use the current version.
5. Register the webhook `https://<APP_URL>/api/v1/webhooks/whatsapp` with the same verify token, and subscribe to `messages`.
6. Restart and send a test from the admin.

**Policy notes built into the app:**
- Messages are sent only to people who opted in, with consent recorded per number.
- Replying STOP or UNSUBSCRIBE records an opt-out, and the app re-checks consent just before sending.
- Business-initiated messages always use approved templates.
- The Cloud API cannot post into ordinary WhatsApp groups, so club announcements go as individual opt-in messages.
- A message is shown as *Sent* when Meta accepts it, and *Delivered* or *Read* only once a status webhook confirms it.

## Payments: enabling later

1. Create a Razorpay account and complete KYC. Generate **test-mode** API keys.
2. `.env` (test mode first):
   ```
   PAYMENT_ENABLED=true
   PAYMENT_PROVIDER=razorpay
   PAYMENT_API_BASE_URL=https://api.razorpay.com
   PAYMENT_API_KEY_ID=rzp_test_…
   PAYMENT_API_KEY_SECRET=…
   PAYMENT_WEBHOOK_SECRET=<random string also entered in the Razorpay dashboard>
   ```
3. In Razorpay → Webhooks, add `https://<APP_URL>/api/v1/webhooks/payments/razorpay` with the same secret and the events `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, `payment.failed`, `refund.processed`.
4. Restart. Approve a test application, open its payment status page, choose **Pay now**, and pay with a Razorpay test card or UPI.
5. Check: the payment shows **Succeeded**, the application shows **Active**, a membership number exists, and **Payments** shows the provider payment id. Replaying the webhook from the dashboard must not change anything (idempotent).
6. Switch to live keys only after this end-to-end test passes.

**Local rehearsal without any account:** set `PAYMENT_ENABLED=true`, `PAYMENT_PROVIDER=mock`, `PAYMENT_WEBHOOK_SECRET=<anything>`. *Pay now* then opens `/payment/mock-checkout`, which sends a signed webhook to the real endpoint. Mock mode is refused when `APP_ENV=production`.

**Other providers** (Stripe, Cashfree, PhonePe and so on): add an adapter in `src/server/adapters/payment/` that implements `createCheckout`, `verifyWebhook` (raw body), `parseWebhook` and `fetchCheckoutStatus`, then register it in `getProviderAdapter`. The rest of the system is provider-neutral. Changing only a URL is **not** enough when the provider's API contract differs.

**Safety guarantees (tested):** the browser redirect never marks anything paid; amounts are checked against the ledger; webhooks with bad signatures are rejected; duplicate events are acknowledged without re-processing; free plans and events never create payments.
