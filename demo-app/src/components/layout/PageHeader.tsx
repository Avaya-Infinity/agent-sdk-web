import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * PageHeader Component
 * 
 * Reusable page header with title, description, and optional actions.
 * Used at the top of each page for consistent styling.
 */
function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'bg-white border-b border-gray-200 px-6 py-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
