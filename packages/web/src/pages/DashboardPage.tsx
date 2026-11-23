import {
  FAIRNESS_CAP_HOURS,
  FAIRNESS_WINDOW_DAYS,
  computeUsageHours,
  daysBetween,
  formatSlot,
  type Persona,
} from '@lablink/shared';
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  GitCompareArrows,
  Gauge,
  Hourglass,
  ShuffleIcon,
  Workflow,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AiSearchPanel } from '../components/AiSearchPanel';
import { StatusBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { Loading } from '../components/States';
import { UpdatesFeed } from '../components/UpdatesFeed';
import { Card } from '../components/ui/Card';
import { LiveStatusPill } from '../components/ui/LiveStatusPill';
import { ProgressBar, RankedBars } from '../components/ui/ProgressBar';
import { StatTile } from '../components/ui/StatTile';
import { greeting, localDateOf, localToday, longDate, splitByRecency } from '../lib/format';
import {
  useApprovals,
  useCatalogIndex,
  useLiveStatus,
  useMyBookings,
  useSession,
  useUtilisation,
} from '../lib/queries';

/** Requests whose deadline is this close are flagged urgent. */
const URGENT_DAYS = 3;

export function DashboardPage() {
  const { data: session } = useSession();
  const persona = session?.persona;
  if (!persona) return <Loading />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{longDate(localToday())}</p>
          <h1 className="page-title mt-1">
            {greeting()}, {persona.name.replace(/^Dr\.\s*/, '').split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{persona.title}</p>
        </div>
        {persona.role === 'student' ? (
          <Link to="/equipment" className="btn-primary">
            Browse equipment <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : (
          <Link to="/approvals" className="btn-primary">
            Review approvals <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </header>

      {persona.role === 'student' ? <StudentDashboard persona={persona} /> : <ReviewerDashboard />}
    </div>
  );
}

function StudentDashboard({ persona }: { persona: Persona }) {
  const { data: bookings = [] } = useMyBookings(true);
  const { data: live } = useLiveStatus();
  const index = useCatalogIndex();
  const today = localToday();

  const upcoming = bookings.filter((b) => b.slot.date >= today && b.status === 'approved');
  const pending = bookings.filter((b) => b.status === 'pending');
  const reallocated = bookings.filter((b) => b.reallocatedFrom && b.slot.date >= today);
  const usedHours = computeUsageHours(bookings, today)[persona.id] ?? 0;
  const nextUp = [...bookings]
    .filter((b) => b.slot.date >= today && (b.status === 'approved' || b.status === 'pending'))
    .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.startHour - b.slot.startHour)
    .slice(0, 4);
  const availableNow = (live ?? []).filter((s) => s.state === 'available').slice(0, 6);

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Upcoming bookings"
          icon={<CalendarCheck aria-hidden="true" className="h-4 w-4" />}
          splits={splitByRecency(
            upcoming.map((b) => b.slot.date),
            'future',
          )}
          to="/bookings"
        />
        <StatTile
          label="Awaiting decision"
          icon={<Hourglass aria-hidden="true" className="h-4 w-4" />}
          splits={splitByRecency(
            pending.map((b) => localDateOf(b.createdAt)),
            'past',
          )}
          to="/bookings"
        />
        <StatTile
          label="Fairly reallocated"
          icon={<ShuffleIcon aria-hidden="true" className="h-4 w-4" />}
          value={reallocated.length}
          hint="Bookings moved to an equivalent device or time to resolve a conflict"
          to="/bookings"
        />
        <li className="card p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <Gauge aria-hidden="true" className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-slate-700">Your fair-share usage</p>
          </div>
          <p className="metric mt-3 text-3xl">
            {usedHours}h{' '}
            <span className="text-sm font-normal text-slate-500">/ {FAIRNESS_CAP_HOURS}h</span>
          </p>
          <div className="mt-2">
            <ProgressBar
              value={usedHours / FAIRNESS_CAP_HOURS}
              label="Fair-share usage"
              tone={usedHours >= FAIRNESS_CAP_HOURS * 0.75 ? 'orange' : 'teal'}
            />
          </div>
          <p className="mt-2 text-2xs text-slate-500">
            Approved hours in {FAIRNESS_WINDOW_DAYS} days. Lower usage raises your priority in
            conflicts.
          </p>
        </li>
      </ul>

      <Link
        to="/planner"
        className="card group flex flex-wrap items-center gap-4 border-violet-200 bg-gradient-to-r from-violet-50 to-brand-50 p-4 transition-shadow hover:shadow-raised"
      >
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-violet-600 text-white">
          <Workflow aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            Plan a whole project in one go
          </span>
          <span className="block text-sm text-slate-600">
            Describe it once — LabLink schedules every machine you need, in the right order, before
            your deadline.
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 text-violet-700 transition-transform group-hover:translate-x-0.5"
        />
      </Link>

      <AiSearchPanel compact />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card
            title="Next up"
            actions={
              <Link to="/bookings" className="text-sm font-medium text-brand-700 hover:underline">
                View all
              </Link>
            }
            bodyClassName="p-0"
          >
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

          <Card
            title="Available right now"
            description="Free this hour across campus"
            actions={
              <Link to="/map" className="text-sm font-medium text-brand-700 hover:underline">
                Open map
              </Link>
            }
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
                        <span className="block truncate text-sm font-medium text-ink">
                          {item.name}
                        </span>
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
        </div>
        <UpdatesFeed />
      </div>
    </>
  );
}

function ReviewerDashboard() {
  const { data: queue } = useApprovals(true);
  const { data: report } = useUtilisation(true);
  const { data: live = [] } = useLiveStatus();
  const today = localToday();

  const pending = queue?.pending ?? [];
  const conflicts = queue?.conflicts ?? [];
  const urgent = pending.filter(
    (p) => daysBetween(today, p.project.deadline) <= URGENT_DAYS,
  ).length;
  const operational = (report?.items ?? []).filter((i) => i.capacityHours > 0);
  const highest = operational.slice(0, 5);
  const lowest = [...operational].sort((a, b) => a.utilisation - b.utilisation).slice(0, 5);
  const count = (state: string) => live.filter((s) => s.state === state).length;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Awaiting approval"
          icon={<Clock3 aria-hidden="true" className="h-4 w-4" />}
          hint="Pending requests for equipment you manage, by when they were submitted"
          urgent={urgent}
          splits={splitByRecency(
            pending.map((p) => localDateOf(p.createdAt)),
            'past',
          )}
          to="/approvals"
        />
        <StatTile
          label="Scheduling conflicts"
          icon={<GitCompareArrows aria-hidden="true" className="h-4 w-4" />}
          hint="Overlapping requests with a recommended fair allocation, by slot date"
          splits={splitByRecency(
            conflicts.map((c) => c.conflict.date),
            'future',
          )}
          to="/approvals"
        />
        <StatTile
          label="Live right now"
          icon={<Gauge aria-hidden="true" className="h-4 w-4" />}
          splits={[
            { label: 'Available', value: count('available') },
            { label: 'In use', value: count('in-use') },
            { label: 'Requested', value: count('requested') },
          ]}
          to="/map"
        />
        <StatTile
          label="Down equipment"
          icon={<Wrench aria-hidden="true" className="h-4 w-4" />}
          value={count('maintenance')}
          to="/insights"
        />
      </ul>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card
            title="Equipment performance"
            description={report ? `${longDate(report.from)} – ${longDate(report.to)}` : undefined}
            actions={
              <Link to="/insights" className="text-sm font-medium text-brand-700 hover:underline">
                Full report
              </Link>
            }
            bodyClassName="grid gap-8 p-5 md:grid-cols-2 [&>*]:min-w-0"
          >
            <div>
              <h3 className="mb-4 text-sm font-semibold text-ink">Highest utilisation</h3>
              <RankedBars
                tone="teal"
                items={highest.map((i) => ({
                  id: i.equipmentId,
                  label: i.name,
                  value: i.utilisation,
                }))}
              />
            </div>
            <div className="md:border-l md:border-slate-200 md:pl-8">
              <h3 className="mb-4 text-sm font-semibold text-ink">Lowest utilisation</h3>
              <RankedBars
                tone="orange"
                items={lowest.map((i) => ({
                  id: i.equipmentId,
                  label: i.name,
                  value: i.utilisation,
                }))}
              />
            </div>
          </Card>

          <Card
            title="Conflicts needing a decision"
            actions={
              <Link to="/approvals" className="text-sm font-medium text-brand-700 hover:underline">
                Resolve
              </Link>
            }
            bodyClassName="p-0"
          >
            {conflicts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No conflicts — every request fits its equipment's capacity.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {conflicts.map((plan) => (
                  <li
                    key={plan.conflict.id}
                    className="flex flex-wrap items-center gap-3 border-l-4 border-l-amber-500 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {pending.find((p) => p.conflictId === plan.conflict.id)?.equipmentName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatSlot({
                          date: plan.conflict.date,
                          startHour: plan.conflict.startHour,
                          endHour: plan.conflict.endHour,
                        })}{' '}
                        · {plan.decisions.length} requests
                      </p>
                    </div>
                    <p className="text-xs text-slate-600">{plan.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <UpdatesFeed />
      </div>
    </>
  );
}
