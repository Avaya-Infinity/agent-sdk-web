import { useState, useEffect, memo } from 'react';

/**
 * Formats countdown seconds to a simple display format
 *
 * @example
 * formatCountdown(12) // returns "12s"
 * formatCountdown(65) // returns "1m 5s"
 */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

interface WrapUpCountdownDisplayProps {
  /** Unix timestamp (seconds) when wrap-up expires. Undefined if no timer is configured. */
  deadline: number | undefined;
  /** Called every second with the current remaining seconds. Useful for parent UI decisions (e.g., hiding buttons). */
  onTick?: (remaining: number) => void;
  className?: string;
}

/**
 * WrapUpCountdownDisplay Component
 *
 * Server-driven countdown timer that computes remaining time from a deadline timestamp.
 * Self-contained — only re-renders itself every second, avoiding parent re-renders.
 *
 * When the deadline changes (e.g., after an extension), the countdown automatically
 * adjusts via the useEffect dependency on deadline.
 *
 * Renders the countdown text (e.g., "| 12s") when active, or nothing when expired/undefined.
 * The backend handles auto-completion when the timer expires — this is display-only.
 */
const WrapUpCountdownDisplay = memo(function WrapUpCountdownDisplay({
  deadline,
  onTick,
  className,
}: WrapUpCountdownDisplayProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (deadline === undefined) {
      setRemaining(0);
      onTick?.(0);
      return;
    }

    // Compute initial remaining time from server deadline
    const computeRemaining = () => Math.max(0, deadline - Math.floor(Date.now() / 1000));

    const initial = computeRemaining();
    setRemaining(initial);
    onTick?.(initial);

    const intervalId = setInterval(() => {
      const next = computeRemaining();
      setRemaining(next);
      onTick?.(next);
      if (next <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [deadline, onTick]);

  if (deadline === undefined || remaining <= 0) {
    return null;
  }

  return (
    <span className={className}>
      | {formatCountdown(remaining)}
    </span>
  );
});

export { WrapUpCountdownDisplay };
