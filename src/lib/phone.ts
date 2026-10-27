import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Normalise a phone number to E.164 (+919876543210). Returns null if invalid. */
export function normalizePhone(input: string, defaultCountry: CountryCode = "IN"): string | null {
  if (!input) return null;
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function maskPhone(e164: string) {
  return e164.length > 6 ? `${e164.slice(0, 3)}••••${e164.slice(-3)}` : "••••";
}
