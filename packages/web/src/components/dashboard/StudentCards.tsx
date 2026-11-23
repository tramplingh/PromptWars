import { formatSlot, type BookingView } from '@lablink/shared';
import { Link } from 'react-router-dom';
import { localToday } from '../../lib/format';
import { useCatalogIndex, useLiveStatus } from '../../lib/queries';
import { StatusBadge } from '../Badges';
import { CategoryIcon } from '../CategoryIcon';
import { Card } from '../ui/Card';
import { LiveStatusPill } from '../ui/LiveStatusPill';

const NEXT_UP_LIMIT = 4;
const AVAILABLE_NOW_LIMIT = 6;

const cardLink = (to: string, label: string) => (
  <Link to={to} className="text-sm font-medium text-brand-700 hover:underline">
    {label}
  </Link>
);

/** The student's next few confirmed or pending sessions, soonest first. */
export function NextUpCard({ bookings }: { bookings: BookingView[] }) {
  const index = useCatalogIndex();
  const today = localToday();
  const nextUp = bookings
    .filter((b) => b.slot.date >= today && (b.status === 'approved' || b.status === 'pending'))
    .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.startHour - b.slot.startHour)
    .slice(0, NEXT_UP_LIMIT);

  return (
    <Card title="Next up" actions={cardLink('/bookings', 'View all')} bodyClassName="p-0">
      {nextUp.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No upcoming bookings yet — find equipment above.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {nextUp.map((b) => {
            const item = index.equipment.get(b.equipmentId);
            return (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                {item && <CategoryIcon category={item.category} size="sm" />}
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/equipment/${b.equipmentId}`}
                    className="block truncate text-sm font-medium text-ink hover:underline"
                  >
                    {b.equipmentName}
                  </Link>
                  <p className="text-xs text-slate-500">{formatSlot(b.slot)}</p>
                </div>
                <StatusBadge status={b.status} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Equipment that is free this hour anywhere on campus. */
export function AvailableNowCard() {
  const index = useCatalogIndex();
  const { data: live = [] } = useLiveStatus();
  const availableNow = live.filter((s) => s.state === 'available').slice(0, AVAILABLE_NOW_LIMIT);

  return (
    <Card
      title="Available right now"
      description="Free this hour across campus"
      actions={cardLink('/map', 'Open map')}
      bodyClassName="p-0"
    >
      <ul className="grid sm:grid-cols-2">
        {availableNow.map((s) => {
          const item = index.equipment.get(s.equipmentId);
          if (!item) return null;
          return (
            <li key={s.equipmentId} className="border-b border-slate-100 sm:odd:border-r">
              <Link
                to={`/equipment/${item.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
              >
                <CategoryIcon category={item.category} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {index.labs.get(item.labId)?.name}
                  </span>
                </span>
                <LiveStatusPill status={s} />
              </Link>
            </li>
          );
        })}
        {availableNow.length === 0 && (
          <li className="px-5 py-6 text-sm text-slate-500">
            Labs are closed right now — check the calendar to book ahead.
          </li>
        )}
      </ul>
    </Card>
  );
}
