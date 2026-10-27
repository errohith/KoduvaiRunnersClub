import { describe, expect, it } from "vitest";
import { canTransition, statusAfterApproval } from "@/server/services/membership";
import { ROLES } from "@/lib/auth/permissions";

describe("membership status machine", () => {
  it("only allows defined transitions", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
    expect(canTransition("PENDING", "REJECTED")).toBe(true);
    expect(canTransition("APPROVED", "ACTIVE")).toBe(true);
    expect(canTransition("REJECTED", "ACTIVE")).toBe(false);
    expect(canTransition("ACTIVE", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
  });
  it("never activates a paid plan without a confirmed payment", () => {
    expect(statusAfterApproval(50000, false)).toBe("APPROVED");
    expect(statusAfterApproval(50000, true)).toBe("ACTIVE");
    expect(statusAfterApproval(0, false)).toBe("ACTIVE");
  });
});

describe("role matrix (least privilege)", () => {
  it("keeps user management with Super Admin only", () => {
    for (const [key, role] of Object.entries(ROLES)) expect(role.permissions.includes("users.manage")).toBe(key === "SUPER_ADMIN");
  });
  it("separates duties between managers", () => {
    expect(ROLES.EVENT_MANAGER.permissions).not.toContain("members.manage");
    expect(ROLES.EVENT_MANAGER.permissions).not.toContain("comms.send");
    expect(ROLES.MEMBERSHIP_MANAGER.permissions).not.toContain("events.manage");
    expect(ROLES.MEMBERSHIP_MANAGER.permissions).not.toContain("registrations.restricted");
    expect(ROLES.COMMUNICATIONS_MANAGER.permissions).not.toContain("payments.manage");
    expect(ROLES.COMMUNICATIONS_MANAGER.permissions).not.toContain("members.export");
  });
});
