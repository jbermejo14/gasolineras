import type { ReactNode } from 'react';
import Link from 'next/link';
import { assetPath, isHtmlOnlyRoute } from '@/lib/site';

interface InternalLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}

/**
 * Enlace interno. Las páginas publicadas solo como HTML (gasolinera y municipio) no tienen
 * datos RSC, así que se enlazan con <a href={assetPath(href)}>; el resto usa next/link.
 */
export function InternalLink({ href, className, children, 'aria-label': ariaLabel }: InternalLinkProps) {
  if (isHtmlOnlyRoute(href)) {
    return (
      <a href={assetPath(href)} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
