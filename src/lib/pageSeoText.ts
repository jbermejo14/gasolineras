import { formatPrice } from './miteco.ts';
import {
  collapseWhitespace,
  fitDescription,
  isSamePlace,
  joinSentences,
  pickTitle,
  shortPlaceName,
} from './seoText.ts';

const NO_PRICES_SENTENCE = 'Consulta los combustibles disponibles.';
const FILLER_OFFICIAL_DATA = 'Datos oficiales de MITECO actualizados a diario.';
const FILLER_COMPARE_NEARBY = 'Compara con otras gasolineras cercanas.';
const FILLER_SAVE = 'Ahorra en cada repostaje.';
const AREA_FILLERS = [FILLER_OFFICIAL_DATA, FILLER_SAVE];
const STATION_FILLERS = [FILLER_OFFICIAL_DATA, FILLER_COMPARE_NEARBY];

function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}

function pluralStations(count: number): string {
  return count === 1 ? '1 estación' : `${count} estaciones`;
}

/** 'Gasolina 95 desde 1,459 €/l y diésel desde 1,399 €/l' (solo los combustibles con precio), o null. */
function minimumPricesPhrase(minG95: number | null, minDiesel: number | null): string | null {
  const parts = [
    minG95 !== null ? `Gasolina 95 desde ${formatPrice(minG95)}` : null,
    minDiesel !== null ? `diésel desde ${formatPrice(minDiesel)}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? capitalizeFirst(parts.join(' y ')) : null;
}

/** 'Ávila (Ávila)' sobra: si municipio y provincia coinciden solo se escribe el nombre. */
function placeWithProvince(place: string, province: string): string {
  return isSamePlace(place, province) ? place : `${place} (${province})`;
}

export interface AreaPricesInput {
  count: number;
  minG95: number | null;
  minDiesel: number | null;
}

/** Título (sin marca) de la página de una provincia. */
export function buildProvinceTitle(province: string): string {
  const short = shortPlaceName(province);
  return (
    pickTitle(
      [`Gasolineras más baratas en ${province} hoy`, `Gasolineras más baratas en ${province}`],
      [`Gasolineras en ${province}`],
      [`Gasolineras más baratas en ${short}`, `Gasolineras en ${short}`]
    ) ?? `Gasolineras ${short}`
  );
}

/** Descripción de la página de una provincia (120-160 caracteres). */
export function buildProvinceDescription(province: string, input: AreaPricesInput): string {
  const prices = minimumPricesPhrase(input.minG95, input.minDiesel);
  const head = `Precios de combustible en ${province} hoy: ${input.count} gasolineras comparadas.`;
  return fitDescription(
    [
      joinSentences(head, prices && `${prices}.`, 'Ahorra repostando en tu provincia.'),
      joinSentences(head, prices && `${prices}.`),
      joinSentences(`Precios de combustible en ${shortPlaceName(province)} hoy.`, prices && `${prices}.`),
    ],
    AREA_FILLERS
  );
}

/** Título (sin marca) de la página de un municipio. */
export function buildMunicipalityTitle(municipality: string, province: string): string {
  const shortMun = shortPlaceName(municipality);
  const shortProv = shortPlaceName(province);
  return (
    pickTitle(
      [
        `Gasolineras más baratas en ${placeWithProvince(municipality, province)}`,
        `Gasolineras más baratas en ${municipality} hoy`,
        `Gasolineras más baratas en ${municipality}`,
      ],
      [`Gasolineras en ${placeWithProvince(municipality, province)}`, `Gasolineras en ${municipality}`],
      [
        `Gasolineras más baratas en ${placeWithProvince(shortMun, shortProv)}`,
        `Gasolineras más baratas en ${shortMun}`,
        `Gasolineras en ${shortMun}`,
      ],
      [`Gasolineras ${shortMun}`, `${shortMun}: gasolineras`]
    ) ?? `${shortMun}: gasolineras`
  );
}

/** Descripción de la página de un municipio (120-160 caracteres). */
export function buildMunicipalityDescription(municipality: string, province: string, input: AreaPricesInput): string {
  const prices = minimumPricesPhrase(input.minG95, input.minDiesel);
  const compare = `Compara ${pluralStations(input.count)} con precios oficiales`;
  const withPrices = (lead: string) => joinSentences(lead, prices ? `${compare}: ${prices}.` : `${compare}.`);
  const shortMun = shortPlaceName(municipality);
  return fitDescription(
    [
      withPrices(`Consulta las gasolineras más baratas en ${placeWithProvince(municipality, province)} hoy.`),
      withPrices(`Gasolineras más baratas en ${municipality} hoy.`),
      withPrices(`Gasolineras en ${shortMun}.`),
      joinSentences(`Gasolineras en ${shortMun}: ${pluralStations(input.count)}.`, prices && `${prices}.`),
    ],
    AREA_FILLERS
  );
}

export interface StationTextInput {
  rotulo: string;
  direccion: string;
  municipio: string;
  horario: string;
  gasolina95: number | null;
  diesel: number | null;
}

/** Título (sin marca) de la ficha de una gasolinera; si el rótulo no cabe, se queda con el municipio. */
export function buildStationTitle(station: Pick<StationTextInput, 'rotulo' | 'municipio'>): string {
  const rotulo = collapseWhitespace(station.rotulo);
  const municipality = station.municipio;
  const shortMun = shortPlaceName(municipality);
  return (
    pickTitle(
      [`Gasolinera ${rotulo} en ${municipality}: precios hoy`, `Gasolinera ${rotulo} en ${municipality}`],
      [`Gasolinera ${rotulo}`],
      [`Gasolinera en ${municipality}: precios hoy`, `Gasolinera en ${municipality}`],
      [`Gasolinera en ${shortMun}`, `Gasolinera ${shortMun}`]
    ) ?? `${shortMun}: gasolinera`
  );
}

function stationPricesSentence(gasolina95: number | null, diesel: number | null): string {
  const parts = [
    gasolina95 !== null ? `Gasolina 95: ${formatPrice(gasolina95)}.` : null,
    diesel !== null ? `Diésel: ${formatPrice(diesel)}.` : null,
  ];
  return joinSentences(...parts) || NO_PRICES_SENTENCE;
}

/** Descripción de la ficha de una gasolinera (120-160 caracteres). */
export function buildStationDescription(station: StationTextInput): string {
  const rotulo = collapseWhitespace(station.rotulo);
  const address = collapseWhitespace(station.direccion);
  const municipality = station.municipio;
  const schedule = collapseWhitespace(station.horario);
  const prices = stationPricesSentence(station.gasolina95, station.diesel);
  const scheduleAndGps = schedule ? `Horario ${schedule} y cómo llegar con GPS.` : 'Cómo llegar con GPS.';
  const scheduleOnly = schedule ? `Horario ${schedule}.` : null;
  const withAddress = `Precios hoy en ${rotulo} (${address}, ${municipality}).`;
  const withoutAddress = `Precios hoy en ${rotulo} (${municipality}).`;
  const anonymous = `Precios hoy en una gasolinera de ${municipality}.`;
  return fitDescription(
    [
      joinSentences(withAddress, prices, scheduleAndGps),
      joinSentences(withAddress, prices, scheduleOnly),
      joinSentences(withAddress, prices, 'Cómo llegar con GPS.'),
      joinSentences(withoutAddress, prices, scheduleAndGps),
      joinSentences(withoutAddress, prices),
      joinSentences(anonymous, prices, scheduleOnly),
      joinSentences(anonymous, prices),
      joinSentences(`Gasolinera en ${municipality}.`, prices),
    ],
    STATION_FILLERS
  );
}
