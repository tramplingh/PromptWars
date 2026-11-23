import { ChevronRight, Menu, Sparkles } from 'lucide-react';
import { useId, useState, type FormEvent, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pageMeta } from '../../lib/navigation';
import { NotificationsPopover } from './NotificationsPopover';
import { ProfileMenu } from './ProfileMenu';

interface TopBarProps {
  onOpenMenu: () => void;
  menuButtonRef: RefObject<HTMLButtonElement>;
}

export function TopBar({ onOpenMenu, menuButtonRef }: TopBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { title, crumbs } = pageMeta(pathname);
  const [ask, setAsk] = useState('');
  const askId = useId();

  /** Global "Ask LabLink": hands the need to the AI equipment matcher. */
  const onAsk = (event: FormEvent) => {
    event.preventDefault();
    const query = ask.trim();
    if (query.length < 3) return;
    navigate(`/equipment?ask=${encodeURIComponent(query)}`);
    setAsk('');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        ref={menuButtonRef}
        type="button"
        className="icon-btn lg:hidden"
        aria-label="Open navigation menu"
        onClick={onOpenMenu}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="hidden sm:block">
            <ol className="flex items-center gap-1 text-2xs font-medium uppercase tracking-wider text-slate-500">
              {crumbs.map((c) => (
                <li key={c} className="flex items-center gap-1">
                  {c}
                  <ChevronRight aria-hidden="true" className="h-3 w-3" />
                </li>
              ))}
            </ol>
          </nav>
        )}
        <p className="truncate text-[15px] font-semibold text-ink" aria-hidden="true">
          {title}
        </p>
      </div>

      <form
        onSubmit={onAsk}
        role="search"
        aria-label="Ask LabLink"
        className="ml-auto hidden max-w-md flex-1 md:block"
      >
        <label htmlFor={askId} className="sr-only">
          Ask LabLink what equipment you need
        </label>
        <div className="relative">
          <Sparkles
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-600"
          />
          <input
            id={askId}
            type="search"
            value={ask}
            maxLength={300}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Ask LabLink: “I need to measure EMG signals”"
            className="field bg-slate-50 pl-9"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-1 md:ml-2">
        <NotificationsPopover />
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <ProfileMenu />
      </div>
    </header>
  );
}
