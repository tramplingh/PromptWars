import { X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useApprovals, useSession, useSwitchPersona } from '../../lib/queries';
import { Loading } from '../States';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** First-time visitors start as a student so the app is usable immediately — no login step. */
const DEFAULT_PERSONA = 's-priya';
const COLLAPSE_KEY = 'lablink:sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Operations-console layout: sidebar navigation, top bar and routed content. */
export function AppShell() {
  const { data: session, isSuccess } = useSession();
  const { mutate: selectPersona, isIdle } = useSwitchPersona();
  const role = session?.persona?.role;
  const { data: queue } = useApprovals(role === 'faculty' || role === 'admin');
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSuccess && !session.persona && isIdle) selectPersona(DEFAULT_PERSONA);
  }, [isSuccess, session, isIdle, selectPersona]);

  // Move focus to the page content on navigation so screen-reader users hear the new page.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        // Preference simply isn't remembered.
      }
      return !value;
    });

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Modal drawer: focus first link, trap Tab inside, close on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return closeDrawer();
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = [
        ...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  const pendingCount = queue?.pending.length ?? 0;

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

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={closeDrawer} />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 animate-fade-in shadow-raised"
          >
            <Sidebar
              role={role}
              pendingCount={pendingCount}
              collapsed={false}
              onNavigate={closeDrawer}
            />
            <button
              type="button"
              className="icon-btn absolute right-2 top-3.5"
              aria-label="Close navigation menu"
              onClick={closeDrawer}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

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
