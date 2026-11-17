/** Nombre de la marca que aparece en la cabecera. */
export const SITE_NAME = 'Ododex';

/** Nombre de la sección dentro de la marca. */
export const SECTION_NAME = 'Gasolineras España';

/** Ruta bajo la que se publica la web dentro de ododex.com. Sin barra final. */
export const BASE_PATH = '/es/gasolineras';

const DEFAULT_SITE_URL = 'http://localhost:3000';
const TRAILING_SLASHES = /\/+$/;
const HTML_ONLY_ROUTE = /^\/(gasolinera\/[^/]+|provincia\/[^/]+\/[^/]+)\/?$/;

/** Origen del sitio, sin ruta ni barra final. Variable NEXT_PUBLIC_SITE_URL; por defecto http://localhost:3000. */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return url.replace(TRAILING_SLASHES, '');
}

function siteRoutePart(path: string): string {
  if (path === '' || path === '/') return '';
  return path.startsWith('/') ? path : `/${path}`;
}

/** URL absoluta de una ruta de la web: origen + BASE_PATH + ruta. absoluteUrl('/') → 'https://ododex.com/es/gasolineras'. */
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${BASE_PATH}${siteRoutePart(path)}`;
}

/** Ruta de un fichero de public/ o de una página con la ruta base: assetPath('/brand/x.svg') → '/es/gasolineras/brand/x.svg'. */
export function assetPath(path: string): string {
  return `${BASE_PATH}${siteRoutePart(path)}`;
}

/**
 * Indica si la ruta interna (sin BASE_PATH) es de una página publicada solo como HTML:
 * '/gasolinera/<x>' o '/provincia/<p>/<m>'. Esas páginas no tienen ficheros .txt de RSC,
 * así que se enlazan con <a> y no con next/link.
 */
export function isHtmlOnlyRoute(path: string): boolean {
  return HTML_ONLY_ROUTE.test(path.split(/[?#]/)[0]);
}
