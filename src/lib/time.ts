import { config } from "@/config/env";

const tz = () => config.APP_TIMEZONE;

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz(), ...opts }).format(new Date(d));
}

export const formatDateTime = (d: Date | string | null | undefined) => formatDate(d, { dateStyle: "medium", timeStyle: "short" });
export const formatTime = (d: Date | string | null | undefined) => formatDate(d, { timeStyle: "short" });

/** Parse a `datetime-local` input value as wall-clock time in the club timezone -> UTC Date. */
export function parseLocalDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) throw new Error(`Invalid date-time "${value}"`);
  const [, y, mo, d, h, mi] = m.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(asUtc - tzOffsetMs(new Date(asUtc)));
}

/** UTC Date -> "YYYY-MM-DDTHH:mm" in the club timezone, for `datetime-local` inputs. */
export function toLocalInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function tzOffsetMs(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz(), year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - at.getTime();
}

export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}
