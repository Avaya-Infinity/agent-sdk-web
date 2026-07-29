import { useState, useEffect, memo } from 'react';

/**
 * Formats duration in seconds to HH:MM:SS format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface TimerDisplayProps {
  /** Start time to count from. Converted to a stable numeric value internally. */
  startTime: Date | null | undefined;
  className?: string;
}

/**
 * TimerDisplay Component
 *
 * Self-contained ticking timer that only re-renders itself every second.
 * Inspired by core-agent-ui's TimerFrom component.
 *
 * Key design choices:
 * - The timer is a COMPONENT (not a hook), so its 1-second state updates
 *   only re-render this tiny element — not the parent CallControlsBar/InteractionCard.
 * - Uses `startTime.getTime()` (a stable number) as the useEffect dependency
 *   instead of the Date object reference (which may be a getter returning new Date on every access).
 * - Syncs to the next whole-second wall-clock boundary so multiple TimerDisplay
 *   instances fire together, allowing React to batch their updates.
 */
const TimerDisplay = memo(function TimerDisplay({ startTime, className }: TimerDisplayProps) {
  const startMs = startTime?.getTime() ?? 0;

  const [duration, setDuration] = useState(() => {
    if (!startMs) return 0;
    const seconds = Math.floor((Date.now() - startMs) / 1000);
    return seconds < 0 ? 0 : seconds;
  });

  useEffect(() => {
    if (!startMs) return;

    // Define inside the effect so the closure always captures the current startMs
    const calc = () => {
      const seconds = Math.floor((Date.now() - startMs) / 1000);
      return seconds < 0 ? 0 : seconds;
    };

    setDuration(calc());

    // Sync to the next whole-second boundary so all timers tick together
    const now = new Date();
    const delay = 1000 - now.getMilliseconds();
    let interval: ReturnType<typeof setInterval>;

    const timeout = setTimeout(() => {
      setDuration(calc());
      interval = setInterval(() => {
        setDuration(calc());
      }, 1000);
    }, delay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [startMs]); // stable number, not a Date object reference

  return (
    <span className={className}>
      {formatDuration(duration)}
    </span>
  );
});

export { TimerDisplay };
