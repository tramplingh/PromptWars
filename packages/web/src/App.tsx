import type { Role } from '@lablink/shared';
import { lazy, Suspense, type ReactNode } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EmptyState, Loading } from './components/States';
import { useSession } from './lib/queries';
import { DiscoverPage } from './pages/DiscoverPage';

// Secondary pages are code-split so the landing page loads with minimal JavaScript.
const EquipmentRoute = lazy(() =>
  import('./pages/EquipmentPage').then((m) => ({ default: m.EquipmentRoute })),
);
const MyBookingsPage = lazy(() =>
  import('./pages/MyBookingsPage').then((m) => ({ default: m.MyBookingsPage })),
);
const ApprovalsPage = lazy(() =>
  import('./pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
);
const InsightsPage = lazy(() =>
  import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })),
);

/** Shows a friendly explanation instead of a page the current role cannot use (the API enforces this too). */
function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending || !data?.persona) return <Loading />;
  if (!roles.includes(data.persona.role)) {
    return (
      <EmptyState title="This view isn’t available for your current profile">
        Switch profile from the menu in the header, or go back to{' '}
        <Link to="/" className="font-semibold text-brand-700 hover:underline">
          Discover
        </Link>
        .
      </EmptyState>
    );
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DiscoverPage />} />
          <Route path="equipment/:id" element={<EquipmentRoute />} />
          <Route
            path="bookings"
            element={
              <RoleGate roles={['student']}>
                <MyBookingsPage />
              </RoleGate>
            }
          />
          <Route
            path="approvals"
            element={
              <RoleGate roles={['faculty', 'admin']}>
                <ApprovalsPage />
              </RoleGate>
            }
          />
          <Route
            path="insights"
            element={
              <RoleGate roles={['faculty', 'admin']}>
                <InsightsPage />
              </RoleGate>
            }
          />
          <Route
            path="*"
            element={
              <EmptyState title="Page not found">
                <Link to="/" className="font-semibold text-brand-700 hover:underline">
                  Return to Discover
                </Link>
              </EmptyState>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
