import { describe, expect, it } from "vitest";
import type { EventCustomField } from "@prisma/client";
import { toCsv } from "@/lib/csv";
import { renderTemplate } from "@/lib/template";
import { registrationWindow, validateCustomFields } from "@/server/services/events";
import { parseLocalDateTime, toLocalInputValue } from "@/lib/time";
import { safeUrl } from "@/lib/url";
import { signToken, verifyToken } from "@/lib/crypto";

describe("csv export", () => {
  it("neutralises spreadsheet formula injection and quotes correctly", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(1)", 'say "hi", ok']]);
    expect(csv).toContain(`'=HYPERLINK(1)`);
    expect(csv).toContain(`"say ""hi"", ok"`);
  });
});

describe("templates", () => {
  it("escapes variables in HTML but not in text", () => {
    expect(renderTemplate("<p>{{name}}</p>", { name: "<script>" }, { html: true })).toBe("<p>&lt;script&gt;</p>");
    expect(renderTemplate("Hi {{ name }}, {{missing}}!", { name: "Asha" })).toBe("Hi Asha, !");
  });
});

describe("links and tokens", () => {
  it("blocks javascript: and data: URLs", () => {
    expect(() => safeUrl("javascript:alert(1)")).toThrow();
    expect(() => safeUrl("data:text/html,x")).toThrow();
    expect(() => safeUrl("//evil.com")).toThrow();
    expect(safeUrl("/join")).toBe("/join");
    expect(safeUrl("https://maps.google.com/x")).toBe("https://maps.google.com/x");
  });
  it("signed tokens detect tampering", () => {
    const t = signToken({ e: "a@b.co" });
    expect(verifyToken<{ e: string }>(t)?.e).toBe("a@b.co");
    expect(verifyToken(t.slice(0, -2) + "xx")).toBeNull();
  });
});

describe("club timezone", () => {
  it("interprets admin date-times in Asia/Kolkata and round-trips them", () => {
    const d = parseLocalDateTime("2027-01-12T05:30");
    expect(d.toISOString()).toBe("2027-01-12T00:00:00.000Z");
    expect(toLocalInputValue(d)).toBe("2027-01-12T05:30");
  });
});

describe("event registration rules", () => {
  const base = { status: "PUBLISHED" as const, registrationEnabled: true, registrationOpensAt: null, registrationClosesAt: null, startsAt: new Date(Date.now() + 86400_000) };
  it("computes the registration window", () => {
    expect(registrationWindow(base)).toBe("open");
    expect(registrationWindow({ ...base, registrationClosesAt: new Date(Date.now() - 1000) })).toBe("closed");
    expect(registrationWindow({ ...base, registrationOpensAt: new Date(Date.now() + 3600_000) })).toBe("not_open_yet");
    expect(registrationWindow({ ...base, status: "CANCELLED" })).toBe("cancelled");
    expect(registrationWindow({ ...base, status: "DRAFT" })).toBe("disabled");
    expect(registrationWindow({ ...base, startsAt: new Date(Date.now() - 1000) })).toBe("past");
  });
  it("validates custom fields by type", () => {
    const f = (o: Partial<EventCustomField>) => ({ id: o.key!, eventId: "e", label: o.key!, type: "TEXT", options: [], required: false, helpText: null, sortOrder: 0, ...o }) as EventCustomField;
    const fields = [f({ key: "club", required: true }), f({ key: "size", type: "SELECT", options: ["S", "M"] }), f({ key: "age", type: "NUMBER" }), f({ key: "ok", type: "CHECKBOX", required: true })];
    const bad = validateCustomFields(fields, { size: "XXL", age: "ten" });
    expect(Object.keys(bad.errors).sort()).toEqual(["customFields.age", "customFields.club", "customFields.ok", "customFields.size"]);
    const good = validateCustomFields(fields, { club: "KR", size: "M", age: "30", ok: "true" });
    expect(good.errors).toEqual({});
    expect(good.values).toHaveLength(4);
  });
});
