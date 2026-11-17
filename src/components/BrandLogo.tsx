import React from 'react';
import { SITE_NAME } from '@/lib/site';

const BRAND_LOGO_WIDTH = 198;
const BRAND_LOGO_HEIGHT = 48;

/**
 * Logotipo de la marca en sus dos variantes; el CSS muestra la que corresponde al tema.
 * Se usa <img> y no next/image porque son SVG estáticos: next/image obligaría a activar `dangerouslyAllowSVG`.
 * Con ambas en el HTML no hay parpadeo al cargar.
 */
export function BrandLogo() {
  return (
    <>
      <img
        src="/brand/ododex-logo-light.svg"
        alt={SITE_NAME}
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        className="h-7 sm:h-8 w-auto block dark:hidden"
      />
      <img
        src="/brand/ododex-logo-dark.svg"
        alt={SITE_NAME}
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        className="h-7 sm:h-8 w-auto hidden dark:block"
      />
    </>
  );
}
