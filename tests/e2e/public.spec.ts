import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/about", "/membership", "/join", "/events", "/marathons", "/news", "/gallery", "/contact", "/privacy", "/join/status"];

test.describe("public website", () => {
  for (const path of PAGES) {
    test(`${path} renders with one h1 and no serious accessibility violations`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    });
  }

  test("membership page lists the five plans with their fees", async ({ page }) => {
    await page.goto("/membership");
    const table = page.getByRole("table", { name: /membership types and fees/i });
    for (const [name, fee] of [["Founding Member", "₹1,000"], ["General Member", "₹500"], ["Student Member", "₹250"], ["Volunteer Member", "Free"], ["Honorary Member", "Free"]]) {
      await expect(table.getByRole("row", { name: new RegExp(name) })).toContainText(fee);
    }
  });

  test("events can be searched and filtered", async ({ page }) => {
    await page.goto("/events");
    await page.getByLabel("Search events").fill("half marathon");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=half\+marathon/);
    await expect(page.getByRole("heading", { level: 3 }).first()).toContainText(/Half Marathon/i);
  });

  test("join form shows server validation errors next to fields", async ({ page }) => {
    await page.goto("/join");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.locator("main [role=alert]").first()).toContainText(/couldn't submit/i);
    await expect(page.locator("#fullName")).toHaveAttribute("aria-invalid", "true");
  });

  test("a runner can apply for membership and gets a reference number", async ({ page }) => {
    const n = Date.now();
    await page.goto("/join?plan=GENERAL");
    await page.getByLabel("Full name").fill("E2E Runner");
    await page.getByLabel("Email address").fill(`e2e${n}@example.com`);
    await page.getByLabel("Mobile number").fill(`+9194${String(n).slice(-8)}`);
    await page.getByLabel("City / town").fill("Koduvai");
    await page.getByLabel("Running experience").selectOption("Walker");
    await page.getByLabel("Contact name").fill("Kin");
    await page.getByLabel("Contact phone").fill("+919123456789");
    await page.getByLabel(/membership terms/).check();
    await page.getByLabel(/privacy policy/).check();
    await page.getByLabel(/information above is accurate/).check();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page).toHaveURL(/registration\/confirmation\?type=membership&ref=KR-M-/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Application received/i);
  });

  test("a runner can register for a free event", async ({ page }) => {
    // Uses whatever free event is currently open, so it does not depend on sample data.
    const events = (await (await page.request.get("/api/v1/events")).json()).data as { slug: string; registration: string; categories: { name: string; feeMinor: number; spotsLeft: number | null }[] }[];
    const target = events.flatMap((e) => (e.registration === "open" ? e.categories.filter((c) => c.feeMinor === 0 && c.spotsLeft !== 0).map((c) => ({ slug: e.slug, category: c.name })) : []))[0];
    test.skip(!target, "No open free event to register for");
    const n = Date.now();
    await page.goto(`/events/${target!.slug}`);
    const radio = page.getByRole("radio", { name: new RegExp(target!.category.replace(/[()]/g, ".")) });
    if (await radio.count()) await radio.check();
    await page.getByLabel("Full name").fill("E2E Racer");
    await page.getByLabel("Email").first().fill(`race${n}@example.com`);
    await page.getByLabel("Mobile number").fill(`+9193${String(n).slice(-8)}`);
    for (const label of ["Contact name", "Contact phone"]) await page.getByLabel(label).fill(label === "Contact name" ? "Kin" : "+919123456789");
    await page.getByLabel(/I accept the event terms/).check();
    await page.getByRole("button", { name: /^Register$/ }).click();
    await expect(page).toHaveURL(/registration\/confirmation\?type=event&ref=KR-E-/);
    await expect(page.getByText("You're confirmed")).toBeVisible();
  });

  test("unknown pages return 404", async ({ page }) => {
    expect((await page.goto("/this-does-not-exist"))?.status()).toBe(404);
  });
});

test.describe("mobile @mobile", () => {
  for (const path of ["/", "/membership", "/events", "/events/sample-sunrise-half-marathon", "/join"]) {
    test(`${path} has no horizontal scroll @mobile`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
  test("mobile menu opens and navigates @mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("#mobile-nav").getByRole("link", { name: "Membership" }).click();
    await expect(page).toHaveURL(/\/membership$/);
  });
});
