import type { Role } from '@lablink/shared';
import { FlaskConical } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApprovals, useSession, useSwitchPersona } from '../lib/queries';
import { RoleSwitcher } from './RoleSwitcher';

/** First-time visitors start as a student so the app is usable immediately — no login step. */
const DEFAULT_PERSONA = 's-priya';

const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: 'Discover', roles: ['student', 'faculty', 'admin'] },
  { to: '/bookings', label: 'My bookings', roles: ['student'] },
  { to: '/approvals', label: 'Approvals', roles: ['faculty', 'admin'] },
  { to: '/insights', label: 'Utilisation', roles: ['faculty', 'admin'] },
];

export function Layout() {
  const { data: session, isSuccess } = useSession();
  const switchPersona = useSwitchPersona();
  const role = session?.persona?.role;
  const isReviewer = role === 'faculty' || role === 'admin';
  const { data: queue } = useApprovals(isReviewer);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  const { mutate: selectPersona, isIdle } = switchPersona;
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

  const pendingCount = queue?.pending.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2 rounded-lg" aria-label="LabLink home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white">
              <FlaskConical aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              Lab<span className="text-brand-600">Link</span>
            </span>
          </NavLink>
          <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
            <ul className="flex gap-1 overflow-x-auto">
              {NAV.filter((item) => role && item.roles.includes(role)).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    {item.label}
                    {item.to === '/approvals' && pendingCount > 0 && (
                      <span className="rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                        {pendingCount}
                        <span className="sr-only"> pending</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto">
            <RoleSwitcher />
          </div>
        </div>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6"
      >
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-slate-600 sm:px-6">
          <p>LabLink · Fair, transparent sharing of campus laboratories</p>
          <p>Demo mode: switch roles from the profile menu — no login required.</p>
        </div>
      </footer>
    </div>
  );
}
