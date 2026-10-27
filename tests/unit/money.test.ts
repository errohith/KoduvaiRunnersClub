import { describe, expect, it } from "vitest";
import { formatMoney, minorToMajorString, parseMajorToMinor } from "@/lib/money";

describe("money", () => {
  it("parses major units to integer minor units without floating point error", () => {
    expect(parseMajorToMinor("1000")).toBe(100000);
    expect(parseMajorToMinor("0.1")).toBe(10);
    expect(parseMajorToMinor("19.99")).toBe(1999);
    expect(parseMajorToMinor("1,000.50")).toBe(100050);
    expect(Number.isInteger(parseMajorToMinor("250.07"))).toBe(true);
  });
  it("rejects invalid or over-precise amounts", () => {
    expect(() => parseMajorToMinor("-5")).toThrow();
    expect(() => parseMajorToMinor("1.005")).toThrow();
    expect(() => parseMajorToMinor("abc")).toThrow();
  });
  it("round-trips and formats INR", () => {
    expect(minorToMajorString(100050)).toBe("1000.50");
    expect(minorToMajorString(5)).toBe("0.05");
    expect(formatMoney(100000, "INR")).toBe("₹1,000");
    expect(formatMoney(25000, "INR")).toBe("₹250");
    expect(formatMoney(0, "INR")).toBe("Free");
  });
});
