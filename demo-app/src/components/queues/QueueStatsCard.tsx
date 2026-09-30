import { CheckCircle2, XCircle, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'success' | 'danger';

interface QueueStatsCardProps {
  label: string;
  value: number;
  variant?: CardVariant;
  className?: string;
}

const variantStyles: Record<CardVariant, { container: string; text: string; icon: string }> = {
  default: {
    container: 'bg-white border-gray-200',
    text: 'text-gray-900',
    icon: 'text-gray-400',
  },
  success: {
    container: 'bg-green-50 border-green-600',
    text: 'text-green-600',
    icon: 'text-green-600',
  },
  danger: {
    container: 'bg-red-50 border-red-500',
    text: 'text-red-500',
    icon: 'text-red-500',
  },
};

const variantIcons: Record<CardVariant, React.ComponentType<{ className?: string }>> = {
  default: LayoutList,
  success: CheckCircle2,
  danger: XCircle,
};

/**
 * QueueStatsCard Component
 * 
 * Displays a single statistic in a card format.
 * Supports different visual variants for different states.
 * Includes icons for WCAG 2.2 AA compliance (non-color indicators).
 */
function QueueStatsCard({
  label,
  value,
  variant = 'default',
  className,
}: QueueStatsCardProps) {
  const styles = variantStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <div
      className={cn(
        'rounded-xl border p-6 shadow-sm',
        styles.container,
        className
      )}
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', styles.icon)} aria-hidden="true" />
        <p className={cn('text-sm', styles.text)}>{label}</p>
      </div>
      <p className={cn('text-4xl font-bold mt-2', styles.text)}>{value}</p>
    </div>
  );
}

export { QueueStatsCard };
export type { CardVariant };
