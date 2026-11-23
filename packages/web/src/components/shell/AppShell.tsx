import { Suspense, useCallback, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useApprovals, useSession } from '../../lib/queries';
import { useDefaultPersona, useFocusOnNavigate, usePersistentFlag } from '../../lib/shellHooks';
import { Loading } from '../States';
import { MobileDrawer } from './MobileDrawer';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Operations-console layout: sidebar navigation, top bar and routed content. */
export function AppShell() {
  const { data: session } = useSession();
  const role = session?.persona?.role;
  const { data: queue } = useApprovals(role === 'faculty' || role === 'admin');
  const [collapsed, toggleCollapsed] = usePersistentFlag('lablink:sidebar-collapsed');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pendingCount = queue?.pending.length ?? 0;

  useDefaultPersona();
  useFocusOnNavigate(mainRef);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 shadow-raised focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 transition-[width] lg:block ${collapsed ? 'w-[72px]' : 'w-60'}`}
      >
        <Sidebar
          role={role}
          pendingCount={pendingCount}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {drawerOpen && <MobileDrawer role={role} pendingCount={pendingCount} onClose={closeDrawer} />}

      <div
        className={`flex min-h-screen flex-col transition-[padding] ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-60'}`}
      >
        <TopBar onOpenMenu={() => setDrawerOpen(true)} menuButtonRef={menuButtonRef} />
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 outline-none sm:px-6 lg:py-8"
        >
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
          LabLink · fair, transparent sharing of campus laboratories · Demo mode: switch roles from
          the profile menu.
        </footer>
      </div>
    </div>
  );
}
