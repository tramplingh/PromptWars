import { ROLES, type Persona, type Role } from '@lablink/shared';
import { UserRound } from 'lucide-react';
import { useId } from 'react';
import { errorMessage } from '../lib/api';
import { usePersonas, useSession, useSwitchPersona } from '../lib/queries';
import { useToast } from './Toast';

const ROLE_LABEL: Record<Role, string> = {
  student: 'Students',
  faculty: 'Faculty',
  admin: 'Lab administration',
};

/**
 * Replaces a login page: pick a campus persona to explore each role's view.
 * The server issues a signed session cookie and enforces permissions per role.
 */
export function RoleSwitcher() {
  const id = useId();
  const { data: personas = [] } = usePersonas();
  const { data: session } = useSession();
  const switchPersona = useSwitchPersona();
  const notify = useToast();

  const grouped = ROLES.map((role) => ({
    role,
    people: personas.filter((p: Persona) => p.role === role),
  }));

  return (
    <div className="flex items-center gap-2">
      <UserRound aria-hidden="true" className="hidden h-5 w-5 text-slate-500 sm:block" />
      <label htmlFor={id} className="sr-only">
        Viewing LabLink as
      </label>
      <select
        id={id}
        className="field max-w-[15rem] py-2 pr-8 font-medium"
        value={session?.persona?.id ?? ''}
        disabled={switchPersona.isPending || personas.length === 0}
        onChange={(event) =>
          switchPersona.mutate(event.target.value, {
            onSuccess: ({ persona }) => persona && notify(`Now viewing as ${persona.name}`, 'info'),
            onError: (error) => notify(errorMessage(error), 'error'),
          })
        }
      >
        {!session?.persona && <option value="">Choose a profile…</option>}
        {grouped.map(({ role, people }) => (
          <optgroup key={role} label={ROLE_LABEL[role]}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
