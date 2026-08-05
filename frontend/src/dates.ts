/**
 * Backend serializes naive UTC timestamps (no 'Z'/offset — see
 * specs/CHANGES.md). `new Date("2026-01-01T12:00:00")` in the browser
 * interprets that string as LOCAL time, not UTC, silently shifting it by
 * the viewer's UTC offset. Any timestamp coming from the API that gets
 * compared against `Date.now()` (grace-period countdowns, "is this in the
 * past" checks) must go through this first.
 */
export function parseUtcMs(iso: string): number {
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTimezone ? iso : `${iso}Z`).getTime();
}
