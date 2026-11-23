import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReviewerDashboard } from '../components/dashboard/ReviewerDashboard';
import { StudentDashboard } from '../components/dashboard/StudentDashboard';
import { Loading } from '../components/States';
import { greeting, localToday, longDate } from '../lib/format';
import { useSession } from '../lib/queries';

/** "Dr. Kavitha Rao" → "Kavitha". */
const firstName = (name: string) => name.replace(/^Dr\.\s*/, '').split(' ')[0] ?? name;

/** Role-aware landing page: students see their work, reviewers see the pipeline. */
export function DashboardPage() {
  const { data: session } = useSession();
  const persona = session?.persona;
  if (!persona) return <Loading />;
  const isStudent = persona.role === 'student';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{longDate(localToday())}</p>
          <h1 className="page-title mt-1">
            {greeting()}, {firstName(persona.name)}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{persona.title}</p>
        </div>
        <Link to={isStudent ? '/equipment' : '/approvals'} className="btn-primary">
          {isStudent ? 'Browse equipment' : 'Review approvals'}{' '}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </header>

      {isStudent ? <StudentDashboard persona={persona} /> : <ReviewerDashboard />}
    </div>
  );
}
