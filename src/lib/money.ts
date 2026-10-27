/** Money helpers. Amounts are integer minor units (paise for INR). Never floats. */

const MINOR_DIGITS: Record<string, number> = { INR: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0 };

export function minorDigits(currency: string) {
  return MINOR_DIGITS[currency.toUpperCase()] ?? 2;
}

/** "1000" or "1000.50" (major units, as typed by an admin) -> 100000 / 100050. */
export function parseMajorToMinor(input: string | number, currency = "INR"): number {
  const s = String(input).trim().replace(/,/g, "");
  const digits = minorDigits(currency);
  const re = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!re.test(s)) throw new Error(`Invalid amount "${input}"`);
  const [whole, frac = ""] = s.split(".");
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt((frac + "0".repeat(digits)).slice(0, digits) || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount too large");
  return Number(minor);
}

export function minorToMajorString(minor: number, currency = "INR"): string {
  const digits = minorDigits(currency);
  if (digits === 0) return String(minor);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const s = String(abs).padStart(digits + 1, "0");
  return `${neg ? "-" : ""}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}

export function formatMoney(minor: number, currency = "INR", locale = "en-IN"): string {
  if (minor === 0) return "Free";
  const digits = minorDigits(currency);
  const showFraction = minor % 10 ** digits !== 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: showFraction ? digits : 0,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}
