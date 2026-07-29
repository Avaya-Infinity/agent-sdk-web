type RelativeTimeFormat = 'short' | 'long';

interface RelativeTimeBadgeProps {
  /**
   * Reference timestamp. Renders the elapsed time since this point.
   * Accepts a `Date` or epoch milliseconds.
   */
  timestamp: Date | number | null | undefined;
  /**
   * Output style:
   * - `'short'` (default): compact `<1m` / `5m` / `2h` / `3d`.
   * - `'long'`: verbose `< 1 minute` / `1 minute` / `5 minutes` / `2 hours` / `3 days`.
   */
  format?: RelativeTimeFormat;
  className?: string;
}

function formatShortAge(startMs: number): string {
  const diffMs = Date.now() - startMs;
  if (diffMs < 0 || !Number.isFinite(diffMs)) return '<1m';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatLongAge(startMs: number): string {
  const minutes = Math.floor((Date.now() - startMs) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return '< 1 minute';
  if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Static relative-time label. Does not tick internally — relies on the parent
 * re-rendering (e.g. on data refresh) to recompute the displayed value.
 */
function RelativeTimeBadge({
  timestamp,
  format = 'short',
  className,
}: RelativeTimeBadgeProps) {
  const startMs =
    typeof timestamp === 'number' ? timestamp : (timestamp?.getTime() ?? 0);
  if (!startMs) return <span className={className}>—</span>;
  const label = format === 'long' ? formatLongAge(startMs) : formatShortAge(startMs);
  return <span className={className}>{label}</span>;
}

export { RelativeTimeBadge };
