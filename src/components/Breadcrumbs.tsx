import React from 'react';
import { InternalLink } from './InternalLink';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className="mb-4 min-w-0">
      <ol className="flex items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--text-muted)] flex-wrap">
        <li>
          <InternalLink href="/" className="inline-flex items-center min-h-10 hover:text-[var(--orange-primary)] transition-colors">
            Inicio
          </InternalLink>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <React.Fragment key={index}>
              <li aria-hidden="true">
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              </li>
              <li className="min-w-0 max-w-full">
                {isLast || !item.href ? (
                  <span className="font-semibold text-[var(--text-main)] break-words" aria-current={isLast ? 'page' : undefined}>
                    {item.label}
                  </span>
                ) : (
                  <InternalLink href={item.href} className="inline-flex items-center min-h-10 break-words hover:text-[var(--orange-primary)] transition-colors">
                    {item.label}
                  </InternalLink>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
