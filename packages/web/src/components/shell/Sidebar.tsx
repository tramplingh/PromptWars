import type { Role } from '@lablink/shared';
import { ChevronsLeft, ChevronsRight, FlaskConical } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { navForRole } from '../../lib/navigation';

interface SidebarProps {
  role: Role | undefined;
  pendingCount: number;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  /** Called after navigating (closes the mobile drawer). */
  onNavigate?: () => void;
}

export function Sidebar({
  role,
  pendingCount,
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: SidebarProps) {
  const groups = navForRole(role);
  return (
    <div className="flex h-full flex-col bg-white">
      <div
        className={`flex h-16 items-center gap-2.5 border-b border-slate-200 ${collapsed ? 'justify-center px-2' : 'px-5'}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-700 text-white">
          <FlaskConical aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
        {!collapsed && (
          <span className="text-[17px] font-bold tracking-tight text-ink">
            Lab<span className="text-brand-700">Link</span>
          </span>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            {collapsed ? (
              <hr className="mx-2 mb-3 border-slate-200" />
            ) : (
              <p className="eyebrow mb-1.5 px-2.5">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'}`
                    }
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                    <span className={collapsed ? 'sr-only' : 'flex-1'}>{label}</span>
                    {to === '/approvals' && pendingCount > 0 && (
                      <span
                        className={`rounded-full bg-amber-100 px-1.5 text-2xs font-bold text-amber-900 ${
                          collapsed ? 'absolute right-0.5 top-0.5' : ''
                        }`}
                      >
                        {pendingCount}
                        <span className="sr-only"> pending</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-pressed={collapsed}
            className={`btn-secondary w-full ${collapsed ? 'px-0' : ''}`}
          >
            {collapsed ? (
              <ChevronsRight aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronsLeft aria-hidden="true" className="h-4 w-4" />
            )}
            <span className={collapsed ? 'sr-only' : ''}>
              {collapsed ? 'Expand sidebar' : 'Collapse'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
