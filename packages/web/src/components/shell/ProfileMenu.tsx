import { ROLES, type Persona, type Role } from '@lablink/shared';
import { Check, ChevronDown } from 'lucide-react';
import { errorMessage } from '../../lib/api';
import { usePersonas, useSession, useSwitchPersona } from '../../lib/queries';
import { useToast } from '../Toast';
import { usePopover } from '../ui/usePopover';

const ROLE_LABEL: Record<Role, string> = {
  student: 'Students',
  faculty: 'Faculty',
  admin: 'Lab administration',
};

export function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * The trigger's accessible name is built from its visible text (plus screen-reader-only
 * context), so speech-input users can say what they see.
 */
function TriggerLabel({ persona }: { persona: Persona | null | undefined }) {
  return (
    <>
      <span className="sr-only md:hidden">
        {persona ? `Viewing as ${persona.name}. Switch profile` : 'Choose a profile'}
      </span>
      <span className="hidden min-w-0 md:block">
        <span className="block max-w-[11rem] truncate text-sm font-medium text-ink">
          <span className="sr-only">Viewing as </span>
          {persona?.name ?? 'Choose profile'}
        </span>
        <span className="block text-2xs capitalize text-slate-600">
          <span className="sr-only">, </span>
          {persona?.role ?? 'demo mode'}
          <span className="sr-only">. Switch profile</span>
        </span>
      </span>
    </>
  );
}

/**
 * Replaces a login page: switch between demo campus personas. The server issues
 * a signed session cookie and enforces each role's permissions.
 */
export function ProfileMenu() {
  const { data: personas = [] } = usePersonas();
  const { data: session } = useSession();
  const switchPersona = useSwitchPersona();
  const notify = useToast();
  const popover = usePopover();
  const current = session?.persona;

  const choose = (persona: Persona) => {
    popover.close();
    if (persona.id === current?.id) return;
    switchPersona.mutate(persona.id, {
      onSuccess: () => notify(`Now viewing as ${persona.name}`, 'info'),
      onError: (error) => notify(errorMessage(error), 'error'),
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 text-left transition-colors hover:bg-slate-100"
        disabled={switchPersona.isPending}
        {...popover.triggerProps}
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800"
        >
          {current ? initials(current.name) : '?'}
        </span>
        <TriggerLabel persona={current} />
        <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-500" />
      </button>

      {popover.open && (
        <div
          id={popover.panelId}
          ref={popover.panelRef}
          role="dialog"
          aria-label="Switch profile"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-fade-in rounded-card border border-slate-200 bg-white p-2 shadow-raised"
        >
          <p className="px-2 pb-2 pt-1 text-xs text-slate-500">
            Demo mode — no login needed. Pick a campus role to explore.
          </p>
          {ROLES.map((role) => (
            <div key={role} className="mb-1">
              <p className="eyebrow px-2 py-1">{ROLE_LABEL[role]}</p>
              <ul>
                {personas
                  .filter((p) => p.role === role)
                  .map((p) => {
                    const active = p.id === current?.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          aria-current={active || undefined}
                          onClick={() => choose(p)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            active ? 'bg-brand-50' : 'hover:bg-slate-100'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-2xs font-bold text-slate-700"
                          >
                            {initials(p.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {p.name}
                            </span>
                            <span className="block truncate text-xs text-slate-600">{p.title}</span>
                          </span>
                          {active && (
                            <Check aria-hidden="true" className="h-4 w-4 text-brand-700" />
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
