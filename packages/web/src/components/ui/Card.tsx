import { useId, type ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  /** Short supporting text under the title. */
  description?: ReactNode;
  /** Controls aligned to the right of the header (filters, links, buttons). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Heading level for the title; defaults to h2. */
  as?: 'h2' | 'h3';
}

/** Bordered surface with an optional labelled header; renders a landmark `section` when titled. */
export function Card({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-5',
  as: Heading = 'h2',
}: CardProps) {
  const id = useId();
  if (!title) {
    return (
      <div className={`card ${className}`}>
        <div className={bodyClassName}>{children}</div>
      </div>
    );
  }
  return (
    <section aria-labelledby={id} className={`card ${className}`}>
      <div className="card-header">
        <div className="min-w-0">
          <Heading id={id} className="card-title">
            {title}
          </Heading>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
