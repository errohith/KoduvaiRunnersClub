import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL!;
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD!;

async function login(page: Page, email = EMAIL, password = PASSWORD) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (password !== "definitely-wrong-password") await page.waitForURL((u) => u.pathname === "/admin");
}

test.describe("admin access control", () => {
  test("anonymous users are sent to the login page", async ({ page }) => {
    await page.goto("/admin/applications");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("admin APIs reject anonymous requests", async ({ request }) => {
    for (const path of ["/api/v1/admin/membership-applications", "/api/v1/admin/payments", "/api/v1/admin/exports/members"]) {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    }
  });

  test("wrong passwords are rejected", async ({ page }) => {
    await login(page, EMAIL, "definitely-wrong-password");
    await expect(page.locator("form [role=alert]")).toContainText(/incorrect/i);
  });

  test("cross-origin form posts to the public API are refused", async ({ request }) => {
    const res = await request.post("/api/v1/contact", { headers: { Origin: "https://evil.example" }, data: {} });
    expect(res.status()).toBe(403);
  });
});

test.describe("admin workflows", () => {
  test("super admin can review and approve a pending application", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    await page.goto("/admin/applications?status=PENDING");
    await page.locator("table a").first().click();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Application approved." })).toBeVisible();
    await expect(page.locator("dl")).toContainText(/Approved|Active/);
  });

  test("plans, events, templates and settings pages load", async ({ page }) => {
    await login(page);
    for (const [path, heading] of [["/admin/plans", /plans/i], ["/admin/events", /events/i], ["/admin/templates", /templates/i], ["/admin/settings", /settings/i], ["/admin/payments", /payments/i], ["/admin/reports", /reports/i], ["/admin/audit", /audit/i]] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    }
  });

  test("CSV export downloads with formula-safe content", async ({ page }) => {
    await login(page);
    const res = await page.request.get("/api/v1/admin/exports/applications");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("Reference,Status,Plan");
  });

  test("an Event Manager cannot reach membership or user management", async ({ page, browser }) => {
    const email = `events${Date.now()}@club.test`;
    await login(page);
    await page.goto("/admin/users");
    const form = page.locator("form", { hasText: "Create user" });
    await form.locator("input[name=name]").fill("Event Volunteer");
    await form.locator("input[name=email]").fill(email);
    await form.locator("input[name=password]").fill("EventManager2026x");
    await form.getByLabel("Event Manager").check();
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("status").filter({ hasText: "created" })).toBeVisible();

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await login(p2, email, "EventManager2026x");
    await p2.goto("/admin/users");
    await expect(p2).toHaveURL(/denied=1/);
    await p2.goto("/admin/applications");
    await expect(p2).toHaveURL(/denied=1/);
    expect((await p2.request.get("/api/v1/admin/membership-applications")).status()).toBe(403);
    expect((await p2.request.get("/api/v1/admin/events")).status()).toBe(200);
    await ctx.close();
  });

  test("super admin can permanently delete an unpaid member after typing the reference", async ({ page }) => {
    const n = Date.now();
    const plans = await (await page.request.get("/api/v1/membership-plans")).json();
    const planId = plans.data.find((p: { code: string }) => p.code === "GENERAL").id;
    const created = await page.request.post("/api/v1/membership-applications", {
      data: { planId, fullName: "Delete Me", email: `del${n}@example.com`, phone: `+9192${String(n).slice(-8)}`, city: "Koduvai", experienceLevel: "Walker", emergencyName: "Kin", emergencyPhone: "+919123456789", acceptTerms: true, acceptPrivacy: true, acceptDeclaration: true },
    });
    const ref = (await created.json()).data.referenceNo as string;
    await login(page);
    await page.goto(`/admin/applications?q=${ref}`);
    await page.getByRole("link", { name: ref }).click();
    await page.getByLabel(/to confirm/).fill(ref);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/admin\/applications/);
    await expect(page.getByRole("status").filter({ hasText: "permanently deleted" })).toBeVisible();
    await page.goto(`/admin/applications?q=${ref}`);
    await expect(page.getByText("Nothing here yet.")).toBeVisible();
  });

  test("super admin can delete an event after typing its slug", async ({ page }) => {
    await login(page);
    const slug = `e2e-delete-${Date.now()}`;
    const res = await page.request.post("/api/v1/admin/events", {
      data: { title: "E2E Delete Event", slug, summary: "Temporary", startsAt: new Date(Date.now() + 7 * 86400_000).toISOString(), venueName: "Ground", city: "Koduvai" },
    });
    expect(res.status()).toBe(201);
    const id = (await res.json()).data.id as string;
    await page.goto(`/admin/events/${id}`);
    await page.locator("#delete").getByLabel(/to confirm/).fill(slug);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete event permanently" }).click();
    await expect(page).toHaveURL(/\/admin\/events/);
    await expect(page.getByRole("status").filter({ hasText: "deleted" })).toBeVisible();
    expect((await page.request.get(`/api/v1/admin/events/${id}`)).status()).toBe(404);
  });
});
