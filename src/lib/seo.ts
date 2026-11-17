import { SITE_NAME } from './site';
import { FUEL_LABELS } from './miteco';
import { HISTORY_FUELS } from './historicoFormat';

export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function getGasStationSchema(station: {
  id: string;
  rotulo: string;
  direccion: string;
  cp: string;
  localidad: string;
  municipio: string;
  provincia: string;
  horario: string;
  lat: number;
  lon: number;
  url: string;
  precios: Record<string, number | null>;
}) {
  const priceSpecs = Object.entries(station.precios)
    .filter(([_, price]) => typeof price === 'number' && price > 0)
    .map(([fuel, price]) => ({
      '@type': 'UnitPriceSpecification',
      price: price as number,
      priceCurrency: 'EUR',
      unitCode: 'LTR',
      name: fuel,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'GasStation',
    name: `${station.rotulo} - ${station.municipio}`,
    identifier: station.id,
    address: {
      '@type': 'PostalAddress',
      streetAddress: station.direccion,
      addressLocality: station.municipio,
      postalCode: station.cp,
      addressRegion: station.provincia,
      addressCountry: 'ES',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: station.lat,
      longitude: station.lon,
    },
    openingHours: station.horario === 'L-D: 24H' ? 'Mo-Su 00:00-24:00' : station.horario,
    url: station.url,
    priceRange: '€€',
    makesOffer: priceSpecs,
  };
}

const DATASET_PRICE_UNIT = '€/l';
const DATASET_SOURCE_URL = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/';

/** Schema.org Dataset de la serie semanal de precios de un área (temporalCoverage = '{primera}/{última}'). */
export function getDatasetSchema(dataset: {
  name: string;
  description: string;
  url: string;
  firstDate: string;
  lastDate: string;
  placeName: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: dataset.name,
    description: dataset.description,
    url: dataset.url,
    temporalCoverage: `${dataset.firstDate}/${dataset.lastDate}`,
    spatialCoverage: { '@type': 'Place', name: dataset.placeName },
    variableMeasured: HISTORY_FUELS.map((fuel) => ({
      '@type': 'PropertyValue',
      name: `Precio de ${FUEL_LABELS[fuel]}`,
      unitText: DATASET_PRICE_UNIT,
    })),
    isBasedOn: DATASET_SOURCE_URL,
    creator: { '@type': 'Organization', name: SITE_NAME },
    dateModified: dataset.lastDate,
  };
}
