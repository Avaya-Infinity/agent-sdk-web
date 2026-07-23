import type { TeamViewMemberInteraction } from '@avaya/infinity-agent-sdk';
import { ChannelIcon } from './ChannelIcon';
import { strings } from '@/locales/en';

interface ChannelCountBadgesProps {
  interactions: TeamViewMemberInteraction[];
}

// Cap how many physical pills we draw, regardless of unique-type count.
const MAX_VISIBLE_PILLS = 3;
// How many pixels each pill in the stack is offset from the previous one.
// Smaller value = tighter stack with more overlap.
const PILL_OFFSET_PX = 14;

/**
 * Stacked-pill badge for a member's active interactions.
 *
 * - All interactions of the same channel type collapse into a single pill
 *   with that channel's icon and the per-type count.
 * - When the member has interactions across multiple channel types, the
 *   primary type (the one with the highest count, tie-broken by first-seen
 *   order) is shown on the front pill. Each additional type adds a ghost
 *   pill behind the front, carrying that type's icon (no count) so the
 *   supervisor can see which other channels are active.
 *
 * Layout uses absolute positioning so the overlap isn't at the mercy of flex
 * margin behavior. A 2px white box-shadow ring around every pill creates a
 * visible seam at the overlap so the stack reads as discrete pills rather
 * than one merged blob.
 */
function ChannelCountBadges({ interactions }: ChannelCountBadgesProps) {
  if (interactions.length === 0) return null;

  // Group by commType, preserving first-encountered order.
  // Keyed as `string` to sidestep the dual-declaration of InteractionCommType
  // inside the SDK; the runtime values are still the same string literals.
  const counts = new Map<string, number>();
  for (const interaction of interactions) {
    const key = interaction.communicationType as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const types = Array.from(counts.keys());

  // Pick the dominant type: highest count, tie-break first-seen.
  let primaryType = types[0];
  let primaryCount = counts.get(primaryType) ?? 0;
  for (const t of types) {
    const c = counts.get(t) ?? 0;
    if (c > primaryCount) {
      primaryType = t;
      primaryCount = c;
    }
  }

  const otherTypes = types.filter((t) => t !== primaryType);
  const visibleGhostTypes = otherTypes.slice(0, MAX_VISIBLE_PILLS - 1);

  return (
    <span
      className="relative inline-flex items-center"
      aria-label={strings.teamView.interactionsCountAriaLabel(interactions.length)}
      style={{
        paddingLeft:
          visibleGhostTypes.length > 0
            ? `${visibleGhostTypes.length * PILL_OFFSET_PX}px`
            : undefined,
      }}
    >
      {visibleGhostTypes.map((type, i) => (
        <span
          key={type}
          aria-hidden="true"
          className="absolute inline-flex items-center justify-center px-1.5 h-5 rounded-full bg-blue-50 text-blue-700"
          style={{
            left: `${i * PILL_OFFSET_PX}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            boxShadow: '0 0 0 2px white',
          }}
        >
          <ChannelIcon commType={type} className="size-3" />
        </span>
      ))}
      <span
        className="relative inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
        style={{ boxShadow: '0 0 0 2px white' }}
      >
        <ChannelIcon commType={primaryType} className="size-3" />
        <span>{primaryCount}</span>
      </span>
    </span>
  );
}

export { ChannelCountBadges };
