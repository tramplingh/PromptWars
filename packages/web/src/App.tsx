import type { Role } from '@lablink/shared';
import { lazy, type ComponentType, type ReactNode } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { EmptyState, Loading } from './components/States';
import { useSession } from './lib/queries';
import { DashboardPage } from './pages/DashboardPage';

// Secondary pages are code-split so the landing dashboard loads with minimal JavaScript.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const EquipmentListPage = page(() => import('./pages/EquipmentListPage'), 'EquipmentListPage');
const EquipmentRoute = page(() => import('./pages/EquipmentPage'), 'EquipmentRoute');
const MapPage = page(() => import('./pages/MapPage'), 'MapPage');
const MyBookingsPage = page(() => import('./pages/MyBookingsPage'), 'MyBookingsPage');
const ApprovalsPage = page(() => import('./pages/ApprovalsPage'), 'ApprovalsPage');
const InsightsPage = page(() => import('./pages/InsightsPage'), 'InsightsPage');
const PlannerPage = page(() => import('./pages/PlannerPage'), 'PlannerPage');
const KioskPage = page(() => import('./pages/KioskPage'), 'KioskPage');
const CheckInPage = page(() => import('./pages/CheckInPage'), 'CheckInPage');

/** Shows a friendly explanation instead of a page the current role cannot use (the API enforces this too). */
function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending || !data?.persona) return <Loading />;
  if (!roles.includes(data.persona.role)) {
    return (
      <EmptyState title="This view isn’t available for your current profile">
        Switch profile from the menu in the top bar, or go back to the{' '}
        <Link to="/" className="font-semibold text-brand-700 hover:underline">
          dashboard
        </Link>
        .
      </EmptyState>
    );
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="equipment" element={<EquipmentListPage />} />
        <Route path="equipment/:id" element={<EquipmentRoute />} />
        <Route path="map" element={<MapPage />} />
        <Route path="check-in" element={<CheckInPage />} />
        <Route
          path="kiosk/:id"
          element={
            <RoleGate roles={['faculty', 'admin']}>
              <KioskPage />
            </RoleGate>
          }
        />
        <Route
          path="planner"
          element={
            <RoleGate roles={['student']}>
              <PlannerPage />
            </RoleGate>
          }
        />
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
                Return to the dashboard
              </Link>
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
