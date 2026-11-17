import type { Gasolinera, MitecoSnapshot } from './miteco';

/** Campos de una estación que necesitan el buscador, las tarjetas y el mapa. */
export type EstacionLigera = Pick<
  Gasolinera,
  | 'id' | 'slug' | 'rotulo' | 'direccion' | 'cp' | 'localidad' | 'municipio'
  | 'provincia' | 'provinciaSlug' | 'horario' | 'lat' | 'lon' | 'precios'
>;

export interface EstacionesPayload {
  fechaMiteco: string;
  estaciones: EstacionLigera[];
}

/** Copia explícita, campo a campo, de los campos de EstacionLigera (nunca un spread). */
export function toEstacionLigera(estacion: Gasolinera): EstacionLigera {
  return {
    id: estacion.id,
    slug: estacion.slug,
    rotulo: estacion.rotulo,
    direccion: estacion.direccion,
    cp: estacion.cp,
    localidad: estacion.localidad,
    municipio: estacion.municipio,
    provincia: estacion.provincia,
    provinciaSlug: estacion.provinciaSlug,
    horario: estacion.horario,
    lat: estacion.lat,
    lon: estacion.lon,
    precios: estacion.precios,
  };
}

export function buildEstacionesPayload(
  snapshot: Pick<MitecoSnapshot, 'fechaMiteco' | 'estaciones'>
): EstacionesPayload {
  return {
    fechaMiteco: snapshot.fechaMiteco,
    estaciones: snapshot.estaciones.map(toEstacionLigera),
  };
}
