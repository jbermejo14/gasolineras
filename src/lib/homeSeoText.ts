import { SITE_NAME } from './site.ts';

/** Título completo de la portada (con marca): la plantilla del layout no se aplica al título por defecto. */
export const HOME_TITLE = `Precio de la gasolina hoy: gasolineras más baratas | ${SITE_NAME}`;

/** Título de la portada en Open Graph y Twitter, sin marca (la aporta siteName). */
export const HOME_SOCIAL_TITLE = 'Precios de gasolineras en España hoy';

export const HOME_DESCRIPTION =
  'Precio de la gasolina 95, diésel y GLP hoy en cada gasolinera de España. Encuentra las estaciones más baratas de tu municipio con datos oficiales de MITECO.';
