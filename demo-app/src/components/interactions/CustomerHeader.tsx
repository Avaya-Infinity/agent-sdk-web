interface CustomerHeaderProps {
  name: string;
  initials: string;
}

/**
 * CustomerHeader Component
 * 
 * Dark header section showing customer avatar, name, and optional badge.
 * Used at the top of the customer details panel.
 */
function CustomerHeader({ name, initials }: CustomerHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#003A51] rounded-t-xl">
      {/* Avatar */}
      <div
        className="flex items-center justify-center w-12 h-12 bg-white rounded-full shrink-0"
        aria-hidden="true"
      >
        <span className="text-lg font-semibold text-[#003A51]">{initials}</span>
      </div>

      {/* Name and badge */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white truncate">{name}</h3>
      </div>
    </div>
  );
}

export { CustomerHeader };
