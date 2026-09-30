/**
 * Formats a past timestamp as an English-friendly relative-time string
 * (e.g. "2 hours ago", "3 days ago"). Matches Moment.js `fromNow()` thresholds.
 * Future timestamps are clamped to "a few seconds ago".
 *
 * @param from - Reference time as a `Date`, ISO 8601 string, or unix ms.
 * @param now - Optional "now" anchor (used by tests). Defaults to `Date.now()`.
 * @returns Relative-time label, or `""` if `from` is null/undefined/unparseable.
 */

const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// Each entry: [upper-bound in seconds (exclusive), formatter for that bucket].
// First entry whose bound is greater than the elapsed seconds wins.
// The `Math.max(2, ...)` clamps on hours/days avoid ungrammatical
// "1 hours ago" / "1 days ago" inside the narrow boundary windows where the
// singular bucket has just ended but `Math.round` still yields 1.
const BUCKETS: ReadonlyArray<readonly [number, (s: number) => string]> = [
    [45,             () => "a few seconds ago"],
    [90,             () => "a minute ago"],
    [44.5 * MIN,     s  => `${Math.round(s / MIN)} minutes ago`],
    [89.5 * MIN,     () => "an hour ago"],
    [21.5 * HOUR,    s  => `${Math.max(2, Math.round(s / HOUR))} hours ago`],
    [35.5 * HOUR,    () => "a day ago"],
    [25.5 * DAY,     s  => `${Math.max(2, Math.round(s / DAY))} days ago`],
    [45 * DAY,       () => "a month ago"],
    // Upper bound is 315d (= 10.5 months) so rounded months never reaches 11
    // — Moment switches to "a year ago" at that point.
    [315 * DAY,      s  => `${Math.round(s / MONTH)} months ago`],
    [547.5 * DAY,    () => "a year ago"],
];

export function formatInteractionAge(
    from: Date | string | number | null | undefined,
    now: Date | number = Date.now(),
): string {
    if (from === null || from === undefined) return "";

    const fromMs = from instanceof Date ? from.getTime() : new Date(from).getTime();
    if (Number.isNaN(fromMs)) return "";

    const nowMs = now instanceof Date ? now.getTime() : now;
    const elapsed = Math.max(0, Math.round((nowMs - fromMs) / 1000));

    const bucket = BUCKETS.find(([upper]) => elapsed < upper);
    return bucket ? bucket[1](elapsed) : `${Math.round(elapsed / YEAR)} years ago`;
}
