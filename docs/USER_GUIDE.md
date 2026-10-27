# Koduvai Runners — step-by-step user guide

This guide covers everything from installing the app to running the club day to day. It is written for the person who sets the app up and the club officers who use the admin portal.

**Contents**

- **Part A — Set up and start the app**
  - 1. Install
  - 2. Configure `.env`
  - 3. Create the database tables
  - 4. Start the app
  - 5. Sign in to the admin portal
- **Part B — First-time club setup**
  - 6. Branding, contact and social links
  - 7. Website pages, navigation, news and photos
  - 8. Membership plans and fees
  - 9. Add committee members as admin users
- **Part C — Day-to-day: membership**
  - 10. What a runner does to join
  - 11. Review and approve applications
  - 12. Record payments (while online payment is off)
  - 13. Manage members (suspend, renew, cancel, delete)
- **Part D — Day-to-day: events and runs**
  - 14. Create an event or run
  - 15. What a runner does to register
  - 16. Manage registrations (check-in, cancel, waitlist, delete)
  - 17. Change, cancel or delete an event
- **Part E — Communication**
  - 18. Edit automatic messages (templates)
  - 19. Send an announcement
  - 20. Check what was sent
- **Part F — Reports, exports and data**
  - 21. Reports and CSV exports
  - 22. Look at the data directly in the database
- **Part G — Using the API (Postman)**
  - 23. Import and run the Postman collection
- **Part H — Going live**
  - 24. Before launch checklist
  - 25. Turning on email, WhatsApp and payments
- **Troubleshooting**

---

## Part A — Set up and start the app

### 1. Install

You need **Node.js 20 or newer** and **PostgreSQL 14 or newer**.

```bash
cd /Users/KoduvaiRunnersWebsite
npm install
```

### 2. Configure `.env`

All settings live in one file, `.env`, in the project folder.

1. If `.env` doesn't exist yet, copy the template: `cp .env.example .env`
2. Open `.env` and set at least:

   | Setting | Example | Notes |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://postgres:PASSWORD@localhost:5432/fde_db?schema=koduvai` | `?schema=koduvai` keeps the club's tables separate from anything else in that database |
   | `DIRECT_DATABASE_URL` | same as above | Used for migrations |
   | `TEST_DATABASE_URL` | same, but with `?schema=koduvai_test` | Used only by automated tests. **Must be different** from `DATABASE_URL` |
   | `AUTH_SECRET` | output of `openssl rand -hex 32` | Keep it secret |
   | `ADMIN_BOOTSTRAP_EMAIL` | `you@example.com` | Your admin login |
   | `ADMIN_BOOTSTRAP_PASSWORD` | 12+ characters, letters and numbers | Change it after your first sign-in |

3. Check the file:
   ```bash
   npm run env:check
   ```
   You should see `✓ Configuration is valid`. Anything wrong is listed by name.

> After changing `.env`, always **restart** the app and the worker (step 4).

### 3. Create the database tables

```bash
npx prisma migrate deploy        # creates the tables
npm run db:seed                  # roles, the 5 membership plans, pages, message templates, your admin account
```
For local testing, `npm run db:seed -- --sample` also adds two sample events and a news post. Delete them before launch (step 17).

Running the seed again is safe. It never overwrites anything you have edited in the admin.

### 4. Start the app

Open **two** terminals in the project folder.

**Terminal 1 — the website:**
```bash
npm run dev                      # development (auto-reloads)
# or, for a production-like run:
npm run build && npm start
```

**Terminal 2 — the background worker:**
```bash
npm run worker
```
The worker sends emails and WhatsApp messages, sends announcements, sends event reminders and expires memberships. **If it isn't running, messages stay "Queued".**

Open **http://localhost:3000** to see the website.

### 5. Sign in to the admin portal

1. Go to **http://localhost:3000/admin/login**
2. Enter `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` from `.env`.
3. Click your name (top right) → **My account** → change your password.
4. In `.env`, set `ADMIN_BOOTSTRAP_ENABLED=false` and restart.

Forgot your password? Run `npm run admin:create -- --email you@example.com --role SUPER_ADMIN` and type a new one.

---

## Part B — First-time club setup

### 6. Branding, contact and social links

**Admin → Branding & settings**

1. **Branding:** club name, tagline, colours (hex codes like `#C2410C`), and logo and hero image URLs.
   - Upload images first in *Media & gallery* (step 7), copy the URL shown under the image, and paste it here.
   - Keep text-on-colour readable. Very light primary colours fail accessibility contrast.
2. **Contact details:** public email, phone, WhatsApp, address, meeting point and run times.
   - For the map, go to Google Maps → *Share* → *Embed a map*, and copy only the `src="…"` URL.
3. **Social links:** full `https://` links.
4. **Membership workflow:**
   - *Accept new applications:* switch this off to close applications.
   - *Require committee approval:* when on, every application waits for a committee member. When off, applications are accepted automatically (free plans become active straight away).
   - *Require date of birth* and *Require emergency contact*.
5. Click **Save** in each box. Changes appear on the website immediately.

### 7. Website pages, navigation, news and photos

| What | Where | How |
|---|---|---|
| Home page text (hero, intro, highlights, stats, call-to-action) | **Pages → Home** | Each *section* has a heading, text and an optional button. *List items* use one line per item: `Label \| Value \| Detail` |
| About, Membership intro and FAQ | **Pages → About / Membership** | FAQ lines: `Question \| \| Answer` |
| Privacy, Terms, Refund policy, Waiver | **Pages → (page)** → *Body* | Written in Markdown. **Review the templates with your committee before launch** |
| A new page (e.g. Code of Conduct) | **Pages → Add a page** | Then add a link under *Navigation* |
| Menu and footer links | **Navigation** | Change the label, link or order, untick *Show* to hide a link, or *Remove* it |
| News | **News → New post** | Set *Status: Published* to show it on the website |
| Photos and gallery | **Media & gallery** | Upload JPG, PNG or WebP (up to 5 MB each) and write alt text describing the photo. Create an *album* to show it on the Gallery page |
| Committee and testimonials | **Committee & testimonials** | Testimonials only appear on the home page once you add real ones, with the member's permission |

### 8. Membership plans and fees

**Admin → Plans & fees**

The five starting plans are Founding ₹1,000, General ₹500, Student ₹250, Volunteer (free) and Honorary (free).

1. Click **Edit plan** on any plan.
2. **Fee** is typed in rupees, e.g. `500` or `500.50`. `0` makes a plan free.
3. **Duration (months):** leave blank for no expiry, or e.g. `12` for yearly membership.
4. **Approval:** *Club default*, *Always require approval* or *Auto-approve*.
5. **Requires student verification:** asks for the institution and student ID on the join form.
6. **Open for new applications:** untick to hide a plan without deleting it.
7. Use **↑ / ↓** to change the order on the website.
8. **Add a plan** at the bottom creates a new one.

> A fee change only affects **new** applications. People who already applied keep the fee they were shown.

### 9. Add committee members as admin users

**Admin → Users & roles → Add a user** (Super Admin only)

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including users, deleting members and deleting events |
| **Club Administrator** | Everything except users and deletion |
| **Membership Manager** | Applications, members, plans; view payments |
| **Event Manager** | Events, registrations (including emergency contacts), check-in, exports |
| **Communications Manager** | Announcements, templates, website content, media |

1. Enter their name, email and a temporary password (12+ characters with letters and numbers), and tick their role(s).
2. Share the password privately and ask them to change it under *My account*.
3. When someone leaves, untick **Active** and click Save. They are signed out immediately.

---

## Part C — Day-to-day: membership

### 10. What a runner does to join

1. The runner goes to the website → **Join the club**, or picks a plan on **Membership**.
2. They choose a plan, fill in the form and accept the terms. WhatsApp and marketing email are optional ticks.
3. They see a confirmation with a **reference number** (e.g. `KR-M-2026-000012`), and an acknowledgement email is sent once email is turned on.
4. The club admins in `CLUB_ADMIN_EMAIL` get a "new application" alert.
5. The runner can check progress at **Join → Check your application status** using the reference number and their email.

### 11. Review and approve applications

**Admin → Applications** (the number in the menu shows how many are waiting)

1. Filter by **Pending**, or search by name, email, phone or reference.
2. Click the reference number to open the application.
3. Check the details. Student applications show the institution and ID.
4. In **Decision**:
   - **Approve**, with an optional welcome note:
     - **Free plan:** the member becomes **Active** straight away and gets a membership number (`KRM-00012`).
     - **Paid plan:** the status becomes **Approved** and a payment request is created. The member becomes Active only once payment is confirmed.
   - **Reject:** a reason is **required**, and it is sent to the applicant.
5. The page shows the full status history and every message sent about the application.

### 12. Record payments (while online payment is off)

Online payment is switched off by default. Until it's on, collect fees by UPI, bank transfer or cash, then record them:

1. Open the application (or **Admin → Payments**, filter *Pending*).
2. In **Record offline payment**, type how you verified it, e.g. `UPI txn 412345678901` or `Cash receipt #12`.
3. Click **Mark as paid** and confirm.
4. The payment becomes **Succeeded**, the application becomes **Active**, and the member is notified. The action is saved in the audit log.

Refunds: **Payments** → find the payment → enter the amount and reason → **Refund**. This *records* a refund you have already made; it doesn't move money itself.

### 13. Manage members (suspend, renew, cancel, delete)

**Admin → Members**

| Action | What it does |
|---|---|
| **Suspend / Reactivate** | Temporarily marks the membership suspended |
| **Renew** | Enter months (e.g. 12) and click Renew to extend the expiry date. Verify the renewal fee first |
| **Cancel** | Ends the membership permanently. The record is kept |
| **Delete…** (Super Admin) | Removes the member's personal data — see below |

**Deleting a member**

1. **Members** → **Delete…**, or open the application and scroll to the red **Delete member** box.
2. Type the reference number exactly, e.g. `KR-M-2026-000012`, and confirm.
3. What happens:
   - **No payment received:** permanently deleted, including the application, membership, history and message log. They can apply again later.
   - **Payment received:** **anonymised**. Name, contact and personal details are erased and the membership is cancelled. The payment amount stays for your accounts.
4. If they ever replied STOP on WhatsApp or unsubscribed from email, that opt-out is kept so they are never messaged again by mistake.

---

## Part D — Day-to-day: events and runs

### 14. Create an event or run

**Admin → Events & marathons → New event**

1. **Basics:**
   - Title.
   - Type: *Club run*, *Marathon / race*, *Training*, *Social*, *Volunteering* or *Other*. Marathon/race events also appear on the Marathons page.
   - Start date and time, in Indian time.
   - Summary (shown on event cards) and description.
   - Cover photo.
2. **Venue & route:** venue, city, map link, route description and route map link. **Schedule** takes one line per item: `05:00 | Bib collection`.
3. **Registration:**
   - Tick **Registration enabled**.
   - Set opening and closing dates (the deadline).
   - **Overall capacity:** blank means unlimited.
   - **Waitlist when full**, and **Accept volunteer sign-ups**.
   - What to collect: date of birth, results category, T-shirt size and the sizes offered.
4. **Terms, waiver & policies:** anything typed in *Liability waiver* or *Medical declaration* must be ticked by the runner. Keep the medical part to a short declaration.
5. Click **Create draft event**. The event is **not visible** yet.
6. On the event page, **Distances & categories** → add at least one (e.g. `10K Run`, fee `600`, capacity `200`, min age `16`, start `06:15`). Free club runs use fee `0`, e.g. `Group run`.
7. **Custom registration fields** (optional): e.g. "Running club", or a dropdown "First race? — Yes, No".
8. Click **Publish** at the top. The event is now live on the website.

### 15. What a runner does to register

1. They open **Events**, search or filter, and open the event.
2. They pick a distance (or *I want to volunteer*), fill in their details and emergency contact, tick the declarations, and click **Register**.
3. What happens next:
   - **Free:** **Confirmed** straight away, with a registration number (`KR-E-2026-000045`).
   - **Paid:** **Payment pending**. Their place is held until you record the payment (step 12 works the same way for events) or online payment is turned on.
   - **Full:** they join the **waitlist** (if enabled), or see "sold out".
4. Confirmed runners get a reminder about 48 hours before the event.

### 16. Manage registrations (check-in, cancel, waitlist, delete)

**Admin → Events & marathons → (event) → Registrations**

| Task | How |
|---|---|
| See who's registered | Filter by status, distance or participants/volunteers, or search by name, email or number |
| Race-day check-in | Click **Check in** next to each confirmed runner |
| Cancel a registration | **Cancel**. The runner is notified, the place is freed, and the first person on the waitlist gets it automatically |
| Move people off the waitlist | **Promote waitlist** (only when places are free) |
| Download the list | **Export CSV**. Emergency contacts and medical notes are included only for Event Managers and above |
| Delete a registration (Super Admin) | **Delete** → confirm. Unpaid: removed and the place freed. Paid: details erased and payment kept. The runner is **not** notified |

### 17. Change, cancel or delete an event

On the event's admin page:

- **Edit:** change anything and click **Save event**. If registered runners need to know, use **Notify registrants of a change**: type the message and send it.
- **Unpublish:** hides the event from the website. Registrations are kept.
- **Cancel event:** type a reason and click **Cancel event**. Every registrant is notified and pending payments are closed. Use this when people have already registered or paid.
- **Delete event** (Super Admin): use this for events created by mistake, test events or the sample events.
  1. Scroll to the red **Delete event** box at the bottom.
  2. Type the event's URL slug (shown in the box), e.g. `sample-sunday-long-run`.
  3. Click **Delete event permanently** and confirm.
  4. This removes the event, its distances and all its registrations. Runners are **not** notified.
  5. If any registration has a **received payment**, deletion is blocked. Cancel the event instead, or delete those registrations individually first.

---

## Part E — Communication

### 18. Edit automatic messages (templates)

**Admin → Templates.** Each automatic message (application received, approved, registration confirmed, reminder, payment received and so on) has an **Email** and a **WhatsApp** version.

1. Open a template and edit the subject and text. `{{name}}`, `{{eventTitle}}` and similar are replaced automatically; the available ones are listed under the form.
2. The right-hand side shows a **preview** with sample data.
3. **Send a test** to your own email.
4. WhatsApp templates must first be approved by Meta (see `docs/INTEGRATIONS.md`). Then enter the approved template name here. Until then, WhatsApp messages are skipped.

### 19. Send an announcement

**Admin → Announcements → New announcement**

1. **Send to:**
   - all active members
   - approved and active applicants
   - members of one plan
   - participants of an event
   - volunteers of an event
2. **Message type:**
   - *Announcement* goes only to people who opted in to club news.
   - *Operational / urgent* goes to everyone in the audience who has a contact. Use it only for essential information such as safety notices or venue changes.
3. **Channels:** Email, and WhatsApp for opted-in people only (needs an approved template name).
4. Write the subject and message. `{{name}}` becomes each person's name.
5. Click **Save draft & review**. The page shows how many people will receive it.
6. **Send test** to yourself, then **Send now** or pick a time and click **Schedule**.
7. The worker sends it in the background. Watch the counts (sent, failed, skipped), and use **Retry failed** if needed. **Cancel** stops anything not yet sent.

### 20. Check what was sent

**Admin → Delivery log** lists every message and its result:

| Status | Meaning |
|---|---|
| **Sent** | The email or WhatsApp provider accepted it |
| **Delivered / Read** | Confirmed by the provider (WhatsApp) |
| **Failed** | Error shown; retried automatically up to the limit |
| **Skipped** | Channel switched off, no consent, or no approved WhatsApp template |

**Contact messages** from the website appear under **Admin → Contact messages**. Reply by email, then *Mark read* or *Archive*.

---

## Part F — Reports, exports and data

### 21. Reports and CSV exports

- **Dashboard:** pending approvals, active members, revenue, upcoming events with places left, and message counts.
- **Reports:** revenue by month (memberships vs events), members by plan, event attendance, and message outcomes.
- **Export CSV** buttons on Applications, Members, Registrations, Payments and Contact messages. The files open in Excel or Google Sheets.
- **Audit log** (Super Admin): who did what and when — approvals, fee changes, deletions, exports and sign-ins.

### 22. Look at the data directly in the database

Read-only checks are fine. Make changes through the admin portal so the rules, notifications and audit log all apply.

```bash
psql -h localhost -U postgres -d fde_db
```
```sql
SET search_path TO koduvai;

-- Active members
SELECT m.membership_no, m.full_name, m.email, p.name AS plan, m.status
FROM memberships m JOIN membership_plans p ON p.id = m.plan_id ORDER BY m.membership_no;

-- Applications
SELECT reference_no, full_name, email, status, (fee_minor/100.0)::numeric(10,2) AS fee_inr
FROM membership_applications ORDER BY created_at DESC;

-- Registrations for an event
SELECT r.registration_no, r.full_name, r.status
FROM event_registrations r JOIN events e ON e.id = r.event_id
WHERE e.slug = 'your-event-slug';
```
Amounts are stored in **paise**: divide by 100 for rupees.

---

## Part G — Using the API (Postman)

### 23. Import and run the Postman collection

The files are in `docs/postman/`:
- `Koduvai-Runners.postman_collection.json` — 45 requests in 9 folders
- `Koduvai-Runners.local.postman_environment.json` — base URL and login

**Steps:**

1. Open Postman → **Import** → select both files.
2. Top-right environment selector → choose **Koduvai Runners — local**.
3. Click the eye icon → edit **adminEmail** and **adminPassword** (your admin login). Keep `baseUrl` as `http://localhost:3000`.
4. Make sure the app is running (step 4).
5. Run **0 · Health & sign-in → Sign in (admin)** first. Postman stores the session cookie, and all admin requests use it.
6. Then either:
   - click requests one by one, top to bottom (each request saves the IDs the next ones need), or
   - right-click the collection → **Run collection** to run everything in order.

**What the folders cover:**

| Folder | Requests |
|---|---|
| 0 · Health & sign-in | Health check, sign in, who am I |
| 1 · Public · Membership | List plans, submit an application, check status, a validation-error example |
| 2 · Public · Events | List and search events, event details |
| 3 · Public · Website | Settings, pages, contact form, OpenAPI document |
| 4 · Admin · Membership | List and approve applications, members, plans, update a fee, **delete a member** |
| 5 · Admin · Events | Create event → add distances → publish → register runners (free and paid) → payment status → list registrations → **delete registration** → **delete event** |
| 6 · Admin · Announcements | List, create, send |
| 7 · Admin · Payments, reports & settings | Payments, report summary, settings (read and re-save), CSV export |
| 8 · Sign out | Sign out, then confirm the admin API refuses access |

**Notes:**
- Running the whole collection creates a few records: an approved test applicant called *Postman Runner*, a contact message and a test announcement. The test event and its registrations are deleted again by folder 5. Remove leftovers with the admin delete tools.
- From the terminal: `npx newman run docs/postman/Koduvai-Runners.postman_collection.json -e docs/postman/Koduvai-Runners.local.postman_environment.json --env-var adminEmail=… --env-var adminPassword=…`
- Sign-in is limited to 8 wrong attempts per email in 15 minutes, and applications to 5 per hour per computer.
- Full API reference: `docs/openapi.json` (also at `http://localhost:3000/api/v1/openapi.json`). You can import it into Postman or Swagger Editor.
- After changing the API, regenerate the collection with `npm run docs:postman`.

---

## Part H — Going live

### 24. Before launch checklist

- [ ] Real club photos uploaded and set as the hero image and event covers
- [ ] Committee members added; sample events and news deleted (step 17)
- [ ] Privacy, Terms, Refund and Waiver pages reviewed by the committee and a legal adviser
- [ ] Contact details, social links and map filled in
- [ ] Each committee member has their own admin user with the right role; bootstrap switched off
- [ ] Email turned on and a test email received (step 25)
- [ ] Backups set up (`docs/BACKUP_RESTORE.md`)
- [ ] Hosting with HTTPS (`docs/DEPLOYMENT.md`), and `APP_URL` set to the real `https://` address

### 25. Turning on email, WhatsApp and payments

These need accounts with outside providers, so they are off by default. `docs/INTEGRATIONS.md` explains exactly what to sign up for and which `.env` values to set:

- **Email:** a provider such as Resend, or your mail provider's SMTP. Set `EMAIL_ENABLED=true` and restart.
- **WhatsApp:** a Meta WhatsApp Business account, approved templates and a webhook.
- **Online payments:** a Razorpay account. Test in test mode first, then go live.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| The app won't start: "Invalid configuration" | Run `npm run env:check` and fix the listed settings in `.env` |
| The website shows no events | Events must be **published**, and the start date must be in the future (or use *Past events*) |
| A runner says "Registration is not available" | Check that *Registration enabled* is ticked, the deadline hasn't passed, and the event is published |
| Messages stuck on "Queued" | Start the worker: `npm run worker` |
| Messages "Skipped" | Email or WhatsApp is switched off in `.env`, the person didn't opt in, or the WhatsApp template isn't approved yet |
| "You do not have permission" | Your role doesn't include that task. Ask a Super Admin |
| "Too many attempts" | Wait 15 minutes (sign-in) or an hour (forms) |
| Can't delete an event | It has paid registrations: cancel the event instead, or delete those registrations first |
| Forgot admin password | `npm run admin:create -- --email you@example.com --role SUPER_ADMIN` |
