import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadUserByToken } from "@/lib/auth/session";
import { sha256 } from "@/lib/crypto";
import { resetData } from "./helpers";

beforeEach(resetData);

async function userWithRole(roleKey: string, opts: { active?: boolean; expired?: boolean } = {}) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const user = await prisma.user.create({ data: { email: `${roleKey.toLowerCase()}${Math.random()}@club.test`, name: roleKey, passwordHash: "x", isActive: opts.active ?? true, roles: { create: { roleId: role.id } } } });
  const token = `tok-${Math.random()}`;
  await prisma.session.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + (opts.expired ? -1 : 1) * 3600_000) } });
  return token;
}

describe("sessions and role permissions from the database", () => {
  it("event managers cannot manage members or users", async () => {
    const u = await loadUserByToken(await userWithRole("EVENT_MANAGER"));
    expect(u?.permissions.has("events.manage")).toBe(true);
    expect(u?.permissions.has("registrations.restricted")).toBe(true);
    expect(u?.permissions.has("members.manage")).toBe(false);
    expect(u?.permissions.has("users.manage")).toBe(false);
  });
  it("communications managers cannot see restricted participant data or payments", async () => {
    const u = await loadUserByToken(await userWithRole("COMMUNICATIONS_MANAGER"));
    expect(u?.permissions.has("comms.send")).toBe(true);
    expect(u?.permissions.has("registrations.restricted")).toBe(false);
    expect(u?.permissions.has("payments.manage")).toBe(false);
  });
  it("rejects unknown, expired and deactivated sessions", async () => {
    expect(await loadUserByToken("nope")).toBeNull();
    expect(await loadUserByToken(undefined)).toBeNull();
    expect(await loadUserByToken(await userWithRole("SUPER_ADMIN", { expired: true }))).toBeNull();
    expect(await loadUserByToken(await userWithRole("SUPER_ADMIN", { active: false }))).toBeNull();
  });
  it("stores only hashed session tokens", async () => {
    const token = await userWithRole("CLUB_ADMIN");
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);
    expect(await prisma.session.count({ where: { tokenHash: sha256(token) } })).toBe(1);
  });
});

describe("migrations", () => {
  it("applied the partial unique indexes and CHECK constraints", async () => {
    const idx = await prisma.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname LIKE '%open%'`;
    expect(idx.map((i) => i.indexname).sort()).toEqual(
      ["event_registrations_open_email_key", "membership_applications_open_email_key", "membership_applications_open_phone_key", "payments_open_membership_key", "payments_open_registration_key"].sort(),
    );
    const checks = await prisma.$queryRaw<{ conname: string }[]>`SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = current_schema() AND contype = 'c'`;
    expect(checks.map((c) => c.conname)).toEqual(expect.arrayContaining(["payments_single_target", "events_capacity_bounds", "membership_plans_fee_nonnegative"]));
  });
});
