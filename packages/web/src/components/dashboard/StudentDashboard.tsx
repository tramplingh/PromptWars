import {
  FAIRNESS_CAP_HOURS,
  FAIRNESS_WINDOW_DAYS,
  computeUsageHours,
  type Persona,
} from '@lablink/shared';
import { ArrowRight, CalendarCheck, Gauge, Hourglass, ShuffleIcon, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { localDateOf, localToday, splitByRecency } from '../../lib/format';
import { useMyBookings } from '../../lib/queries';
import { AiSearchPanel } from '../AiSearchPanel';
import { UpdatesFeed } from '../UpdatesFeed';
import { ProgressBar } from '../ui/ProgressBar';
import { StatTile } from '../ui/StatTile';
import { AvailableNowCard, NextUpCard } from './StudentCards';

/** Usage at which the meter turns orange as a gentle fair-share warning. */
const USAGE_WARNING_SHARE = 0.75;

export function StudentDashboard({ persona }: { persona: Persona }) {
  const { data: bookings = [] } = useMyBookings(true);
  const today = localToday();
  const upcoming = bookings.filter((b) => b.slot.date >= today && b.status === 'approved');
  const pending = bookings.filter((b) => b.status === 'pending');
  const reallocated = bookings.filter((b) => b.reallocatedFrom && b.slot.date >= today);
  const usedHours = computeUsageHours(bookings, today)[persona.id] ?? 0;

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
        <FairShareTile usedHours={usedHours} />
      </ul>

      <PlannerCallToAction />
      <AiSearchPanel compact />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <NextUpCard bookings={bookings} />
          <AvailableNowCard />
        </div>
        <UpdatesFeed />
      </div>
    </>
  );
}

/** The student's approved (and no-show) hours against the fair-share cap the engine uses. */
function FairShareTile({ usedHours }: { usedHours: number }) {
  const tone = usedHours >= FAIRNESS_CAP_HOURS * USAGE_WARNING_SHARE ? 'orange' : 'teal';
  return (
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
        <ProgressBar value={usedHours / FAIRNESS_CAP_HOURS} label="Fair-share usage" tone={tone} />
      </div>
      <p className="mt-2 text-2xs text-slate-500">
        Approved hours in {FAIRNESS_WINDOW_DAYS} days. Lower usage raises your priority in
        conflicts.
      </p>
    </li>
  );
}

function PlannerCallToAction() {
  return (
    <Link
      to="/planner"
      className="card group flex flex-wrap items-center gap-4 border-violet-200 bg-gradient-to-r from-violet-50 to-brand-50 p-4 transition-shadow hover:shadow-raised"
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-violet-600 text-white">
        <Workflow aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">Plan a whole project in one go</span>
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
  );
}
