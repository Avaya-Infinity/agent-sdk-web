import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { User } from '@avaya/infinity-agent-sdk';
import { MainLayout } from '@/components/layout';
import { InteractionsPage } from '@/components/interactions';
import { QueuesPage } from '@/components/queues';
import { TeamViewPage } from '@/components/teamview';

/**
 * Creates the application router with the authenticated user context.
 *
 * Routes:
 * - /interactions - Customer interactions view (includes Discover Interactions tab)
 * - /queues - Queue management view
 * - /team-view - Team View (supervisor)
 * - /viewing - Live viewing of interactions
 * - / - Redirects to /interactions
 *
 * Note: /viewing redirects to /interactions for back-compat — the viewing
 * surface is now a tab inside the Interactions page.
 */
export function createAppRouter(user: User, onSignOut?: () => void) {
  return createBrowserRouter(
    [
      {
        path: '/',
        element: <MainLayout user={user} onSignOut={onSignOut} />,
        children: [
          {
            index: true,
            element: <Navigate to="/interactions" replace />,
          },
          {
            path: 'interactions',
            element: <InteractionsPage user={user} />,
          },
          {
            path: 'queues',
            element: <QueuesPage user={user} />,
          },
          {
            path: 'team-view',
            element: <TeamViewPage user={user} />,
          },
          {
            path: 'viewing',
            element: <Navigate to="/interactions" replace />,
          },
        ],
      },
    ],
    { basename: import.meta.env.BASE_URL }
  );
}
