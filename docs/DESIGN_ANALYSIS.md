# Design analysis — reference sites

Reviewed 20 Oct 2026 (public pages only): RunClubHQ (features), RunSignup (running-club use case), HappyMilez (home), Trackie (home). These were used as inspiration only. No text, branding, code or imagery was copied.

## Useful patterns we adopted

| Pattern | Seen on | How we used it |
|---|---|---|
| One clear primary CTA, repeated at the end of long pages | RunSignup | "Join the club" in the header, hero, footer and a closing CTA band. |
| Event discovery near the top of the home page, as dated cards | HappyMilez, Trackie | "Upcoming events" is the second section. Cards show a date chip, distances, price range and places left. |
| Capacity locking, waitlists and custom questions | RunClubHQ, Trackie | Atomic capacity counters, an ordered waitlist with auto-promotion, and per-event custom fields. |
| Audience-specific grouping | RunClubHQ | Navigation separates *Membership*, *Events*, *Marathons* and *News*. The admin groups tools by role. |
| Test sends and per-recipient delivery tracking | RunClubHQ | Test send on every template and announcement, plus a delivery log with provider status. |
| Human-in-the-loop approvals | RunClubHQ | Membership approval queue with status history and audit log. |
| Exportable lists for the committee | RunSignup | CSV exports for applications, members, participants, payments and messages. |
| Plain FAQ that handles beginner objections | HappyMilez, RunSignup | Membership FAQ, editable by admins. |

## Shortcomings we avoided

- **Hidden pricing** (RunClubHQ, RunSignup defer pricing to other pages). Our membership fees are on the home page, the membership page and a comparison table.
- **Login and Sign-up going to the same page** (HappyMilez, Trackie). Runners never need an account: joining is a single public form with a reference number and a status lookup. Admin sign-in is separate.
- **Search without filters** (HappyMilez, Trackie). Events have text search, a type filter and an upcoming/past toggle that are shareable via URL.
- **Footer links that point to the same page under different labels** (HappyMilez). Every navigation link is unique and editable in the admin.
- **Long, repetitive single pages and jargon** (RunClubHQ). Pages are short and sectioned, and the copy is plain.
- **Registration flow not shown** (Trackie, RunSignup). Each event page shows distances, fees, eligibility, schedule, policies and the form in one place.
- **Padded social proof** (HappyMilez repeats testimonials). The testimonials section only renders when the club adds real, consented quotes. None are seeded.

## Opportunities taken

- Mobile-first layout with no horizontal scroll (tested with Playwright on a Pixel 7 viewport).
- WCAG AA contrast and an axe scan on every public page in CI. The default brand orange was darkened to `#C2410C` to reach 4.5:1 contrast with white text.
- Separate consent for WhatsApp and marketing email at the point of collection.
- Payment-pending states that are honest when online payments are not yet enabled.

## Visual direction

Deep navy ink (`#14213D`) with a burnt-orange primary and an amber accent, evoking an early-morning run. Typography is condensed uppercase display (Barlow Condensed) over Inter body text. The default artwork is an abstract running track used *only* until the club uploads authentic photos. No stock or AI imagery is shipped. All colours, the logo, the hero image and the copy are editable in **Admin → Branding & settings**.
