import type { Metadata } from 'next';
import type { Gasolinera, MitecoSnapshot } from './miteco.ts';
import { calcularTodasLasStats } from './miteco.ts';
import { absoluteUrl } from './site.ts';
import { buildSocialMetadata } from './socialMetadata.ts';
import {
  buildMunicipalityDescription,
  buildMunicipalityTitle,
  buildProvinceDescription,
  buildProvinceTitle,
  buildStationDescription,
  buildStationTitle,
  type AreaPricesInput,
} from './pageSeoText.ts';

export type ProvinceEntry = MitecoSnapshot['provinciasMap'] extends Map<string, infer V> ? V : never;
export type MunicipalityEntry = MitecoSnapshot['municipiosMap'] extends Map<string, infer V> ? V : never;

interface PageMetadataParts {
  title: string;
  description: string;
  /** Ruta interna de la página, sin BASE_PATH. */
  path: string;
}

function assemblePageMetadata({ title, description, path }: PageMetadataParts): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    ...buildSocialMetadata({ title, description, path }),
  };
}

function areaPrices(stations: Gasolinera[]): AreaPricesInput {
  const stats = calcularTodasLasStats(stations);
  return { count: stations.length, minG95: stats.gasolina95.min, minDiesel: stats.diesel.min };
}

/** Ruta interna de la ficha de una gasolinera: /gasolinera/<id>-<slug>. */
export function stationPagePath(station: Pick<Gasolinera, 'id' | 'slug'>): string {
  return `/gasolinera/${station.id}-${station.slug}`;
}

/** Metadatos (título, descripción, canonical, Open Graph y Twitter) de la página de una provincia. */
export function buildProvinceMetadata(province: ProvinceEntry): Metadata {
  return assemblePageMetadata({
    title: buildProvinceTitle(province.provincia),
    description: buildProvinceDescription(province.provincia, areaPrices(province.estaciones)),
    path: `/provincia/${province.provinciaSlug}`,
  });
}

/** Metadatos (título, descripción, canonical, Open Graph y Twitter) de la página de un municipio. */
export function buildMunicipalityMetadata(municipality: MunicipalityEntry): Metadata {
  return assemblePageMetadata({
    title: buildMunicipalityTitle(municipality.municipio, municipality.provincia),
    description: buildMunicipalityDescription(
      municipality.municipio,
      municipality.provincia,
      areaPrices(municipality.estaciones)
    ),
    path: `/provincia/${municipality.provinciaSlug}/${municipality.municipioSlug}`,
  });
}

/** Metadatos (título, descripción, canonical, Open Graph y Twitter) de la ficha de una gasolinera. */
export function buildStationMetadata(station: Gasolinera): Metadata {
  return assemblePageMetadata({
    title: buildStationTitle(station),
    description: buildStationDescription({
      rotulo: station.rotulo,
      direccion: station.direccion,
      municipio: station.municipio,
      horario: station.horario,
      gasolina95: station.precios.gasolina95,
      diesel: station.precios.diesel,
    }),
    path: stationPagePath(station),
  });
}
