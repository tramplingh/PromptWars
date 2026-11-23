import type { Role } from '@lablink/shared';
import {
  BarChart3,
  Boxes,
  CalendarCheck,
  ClipboardCheck,
  LayoutDashboard,
  Map as MapIcon,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ['student', 'faculty', 'admin'];
const REVIEWERS: Role[] = ['faculty', 'admin'];

/** Single source of truth for sidebar structure and page titles. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Explore',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
      { to: '/equipment', label: 'Equipment', icon: Boxes, roles: ALL },
      { to: '/map', label: 'Campus map', icon: MapIcon, roles: ALL },
    ],
  },
  {
    label: 'My work',
    items: [
      { to: '/planner', label: 'Project planner', icon: Workflow, roles: ['student'] },
      { to: '/bookings', label: 'My bookings', icon: CalendarCheck, roles: ['student'] },
    ],
  },
  {
    label: 'Lab management',
    items: [
      { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, roles: REVIEWERS },
      { to: '/insights', label: 'Utilisation', icon: BarChart3, roles: REVIEWERS },
    ],
  },
];

export function navForRole(role: Role | undefined): NavGroup[] {
  if (!role) return [];
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

/** Title and breadcrumb trail for the current path. */
export function pageMeta(pathname: string): { title: string; crumbs: string[] } {
  if (pathname.startsWith('/kiosk/')) return { title: 'Lab kiosk', crumbs: ['Lab management'] };
  if (pathname === '/check-in') return { title: 'Check in', crumbs: ['My work'] };
  if (pathname.startsWith('/equipment/'))
    return { title: 'Equipment details', crumbs: ['Explore', 'Equipment'] };
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.to === pathname);
    if (item) return { title: item.label, crumbs: [group.label] };
  }
  return { title: 'Not found', crumbs: [] };
}
