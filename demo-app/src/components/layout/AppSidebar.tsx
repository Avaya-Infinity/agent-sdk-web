import { NavLink } from 'react-router-dom';
import { MessageSquare, ListOrdered } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AppSidebarProps {
  interactionCount?: number;
}

/**
 * AppSidebar Component
 *
 * Main navigation sidebar — icon-only buttons with tooltips on hover. The
 * active item shows a soft-blue fill behind its icon.
 */
function AppSidebar({ interactionCount = 0 }: AppSidebarProps) {
  const navItems: NavItem[] = [
    {
      title: strings.nav.interactions,
      path: '/interactions',
      icon: MessageSquare,
    },
    {
      title: strings.nav.queues,
      path: '/queues',
      icon: ListOrdered,
    },
  ];

  return (
    <aside className="w-16 border-r border-gray-200 bg-white flex flex-col shrink-0">
      <TooltipProvider delayDuration={200}>
        <nav className="flex flex-col items-center gap-3 pt-3">
          {navItems.map((item) => (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  aria-label={item.title}
                  className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                >
                  {({ isActive }) => (
                    <div
                      className={cn(
                        'relative flex items-center justify-center h-10 w-10 rounded-md transition-colors',
                        isActive ? 'bg-blue-100' : 'hover:bg-gray-100'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'size-5',
                          isActive ? 'text-blue-500' : 'text-gray-500'
                        )}
                        aria-hidden="true"
                      />
                      {item.path === '/interactions' && interactionCount > 0 && (
                        <div
                          className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full"
                          aria-label={`${interactionCount} new interaction${interactionCount > 1 ? 's' : ''}`}
                          role="status"
                        >
                          <span aria-hidden="true">{interactionCount}</span>
                        </div>
                      )}
                    </div>
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">{item.title}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </TooltipProvider>
    </aside>
  );
}

export { AppSidebar };
