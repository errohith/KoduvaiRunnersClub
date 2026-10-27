import { api, ok } from "@/lib/api";
import { listPublicEvents, registrationWindow, spotsLeft } from "@/server/services/events";

export const GET = api(async (req) => {
  const u = new URL(req.url);
  const events = await listPublicEvents({
    q: u.searchParams.get("q") ?? undefined,
    type: u.searchParams.get("type") ?? undefined,
    when: u.searchParams.get("when") === "past" ? "past" : "upcoming",
    city: u.searchParams.get("city") ?? undefined,
  });
  return ok(
    events.map((e) => ({
      id: e.id, slug: e.slug, title: e.title, summary: e.summary, type: e.type, status: e.status, startsAt: e.startsAt, venueName: e.venueName, city: e.city,
      registration: registrationWindow(e), spotsLeft: spotsLeft(e.capacity, e.registeredCount),
      categories: e.categories.map((c) => ({ id: c.id, name: c.name, distanceKm: c.distanceKm ? Number(c.distanceKm) : null, feeMinor: c.feeMinor, spotsLeft: spotsLeft(c.capacity, c.registeredCount) })),
      currency: e.currency,
    })),
  );
});
