/** Comunidad autónoma con el código IDCCAA que usa MITECO (no el del INE). */
export interface Comunidad {
  id: string;
  name: string;
  slug: string;
}

export const COMUNIDADES: readonly Comunidad[] = [
  { id: '01', name: 'Andalucía', slug: 'andalucia' },
  { id: '02', name: 'Aragón', slug: 'aragon' },
  { id: '03', name: 'Asturias', slug: 'asturias' },
  { id: '04', name: 'Islas Baleares', slug: 'islas-baleares' },
  { id: '05', name: 'Canarias', slug: 'canarias' },
  { id: '06', name: 'Cantabria', slug: 'cantabria' },
  { id: '07', name: 'Castilla-La Mancha', slug: 'castilla-la-mancha' },
  { id: '08', name: 'Castilla y León', slug: 'castilla-y-leon' },
  { id: '09', name: 'Cataluña', slug: 'cataluna' },
  { id: '10', name: 'Comunidad Valenciana', slug: 'comunidad-valenciana' },
  { id: '11', name: 'Extremadura', slug: 'extremadura' },
  { id: '12', name: 'Galicia', slug: 'galicia' },
  { id: '13', name: 'Comunidad de Madrid', slug: 'comunidad-de-madrid' },
  { id: '14', name: 'Región de Murcia', slug: 'region-de-murcia' },
  { id: '15', name: 'Navarra', slug: 'navarra' },
  { id: '16', name: 'País Vasco', slug: 'pais-vasco' },
  { id: '17', name: 'La Rioja', slug: 'la-rioja' },
  { id: '18', name: 'Ceuta', slug: 'ceuta' },
  { id: '19', name: 'Melilla', slug: 'melilla' },
];

/** Busca una comunidad por su IDCCAA de MITECO; null si no existe. */
export function findComunidadById(id: string): Comunidad | null {
  return COMUNIDADES.find((comunidad) => comunidad.id === id) ?? null;
}

/** Busca una comunidad por su slug; null si no existe. */
export function findComunidadBySlug(slug: string): Comunidad | null {
  return COMUNIDADES.find((comunidad) => comunidad.slug === slug) ?? null;
}
