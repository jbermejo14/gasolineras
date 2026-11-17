import type { AreaHistory, AreaKind, FuelSeries, HistoryFuel, PriceMilli } from './historicoFormat.ts';
import { yearOfIso } from './historicoFormat.ts';

export interface DatedValue {
  date: string;
  value: PriceMilli;
}

export interface SeriesSummary {
  latest: DatedValue | null;
  yearAgo: DatedValue | null;
  changePct: number | null;
  max: DatedValue | null;
  min: DatedValue | null;
  yearlyAverages: { year: number; avg: PriceMilli; weeks: number }[];
}

const MILLIS_PER_EURO = 1000;
const MILLIS_PER_WEEK = 7 * 86_400_000;
const YEAR_AGO_TARGET_WEEKS = 52;
const YEAR_AGO_MIN_WEEKS = 50;
const YEAR_AGO_MAX_WEEKS = 54;
const PERCENT_FACTOR = 100;
const ONE_DECIMAL_FACTOR = 10;
const MILLIS_PER_CENT = 10;

const HISTORICO_STATS_INTRO_FUELS: { fuel: HistoryFuel; label: string }[] = [
  { fuel: 'gasolina95', label: 'la gasolina 95' },
  { fuel: 'diesel', label: 'el diésel' },
];

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formatea milésimas de euro sin unidad: 1459 → '1,459'. */
export function formatMilliNumber(value: PriceMilli): string {
  return (value / MILLIS_PER_EURO).toFixed(3).replace('.', ',');
}

/** Formatea milésimas de euro: 1459 → '1,459 €/l'. */
export function formatMilliEuro(value: PriceMilli): string {
  return `${formatMilliNumber(value)} €/l`;
}

/** Formatea una variación con signo y una decimal: 3.24 → '+3,2 %', -6.3 → '-6,3 %', 0 → '0,0 %'. */
export function formatSignedPercent(value: number): string {
  const text = historicoStatsDecimal(value);
  const sign = Number(text.replace(',', '.')) > 0 ? '+' : '';
  return `${sign}${text} %`;
}

/** Formatea una fecha ISO sin depender de Intl ni de la zona horaria: '2022-07-04' → '4 de julio de 2022'. */
export function formatIsoDateEs(iso: string): string {
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) {
    throw new RangeError(`Fecha no válida "${iso}": se esperaba el formato yyyy-mm-dd.`);
  }
  const month = MONTH_NAMES_ES[Number(match[2]) - 1];
  if (month === undefined) {
    throw new RangeError(`Fecha no válida "${iso}": el mes debe estar entre 01 y 12.`);
  }
  return `${Number(match[3])} de ${month} de ${match[1]}`;
}

/** Redondea a un decimal sobre el valor absoluto (simétrico respecto al cero): -6,25 → -6,3. */
function historicoStatsRoundOneDecimal(value: number): number {
  return Math.sign(value) * (Math.round(Math.abs(value) * ONE_DECIMAL_FACTOR) / ONE_DECIMAL_FACTOR);
}

function historicoStatsWeeksBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / MILLIS_PER_WEEK;
}

function historicoStatsLatest(weeks: readonly string[], values: FuelSeries): number {
  for (let index = Math.min(weeks.length, values.length) - 1; index >= 0; index--) {
    if (values[index] !== null) return index;
  }
  return -1;
}

function historicoStatsYearAgo(weeks: readonly string[], values: FuelSeries, latestIndex: number): DatedValue | null {
  let best: DatedValue | null = null;
  let bestDistance = Infinity;
  for (let index = 0; index < latestIndex; index++) {
    const value = values[index];
    if (value === null) continue;
    const gap = historicoStatsWeeksBetween(weeks[index], weeks[latestIndex]);
    if (gap < YEAR_AGO_MIN_WEEKS || gap > YEAR_AGO_MAX_WEEKS) continue;
    const distance = Math.abs(gap - YEAR_AGO_TARGET_WEEKS);
    // Con empate de distancia gana el más antiguo: el bucle avanza en el tiempo y solo sustituye si mejora estrictamente.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { date: weeks[index], value };
    }
  }
  return best;
}

function historicoStatsExtremes(
  weeks: readonly string[],
  values: FuelSeries,
): { max: DatedValue | null; min: DatedValue | null } {
  let max: DatedValue | null = null;
  let min: DatedValue | null = null;
  const length = Math.min(weeks.length, values.length);
  for (let index = 0; index < length; index++) {
    const value = values[index];
    if (value === null) continue;
    if (max === null || value > max.value) max = { date: weeks[index], value };
    if (min === null || value < min.value) min = { date: weeks[index], value };
  }
  return { max, min };
}

function historicoStatsYearlyAverages(weeks: readonly string[], values: FuelSeries): SeriesSummary['yearlyAverages'] {
  const totals = new Map<number, { sum: number; weeks: number }>();
  const length = Math.min(weeks.length, values.length);
  for (let index = 0; index < length; index++) {
    const value = values[index];
    if (value === null) continue;
    const year = yearOfIso(weeks[index]);
    const total = totals.get(year) ?? { sum: 0, weeks: 0 };
    total.sum += value;
    total.weeks += 1;
    totals.set(year, total);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, total]) => ({
      year,
      avg: Math.round(total.sum / total.weeks),
      weeks: total.weeks,
    }));
}

/** Resume una serie semanal: último valor, hace un año, variación, extremos y medias anuales. */
export function summarizeSeries(weeks: readonly string[], values: FuelSeries): SeriesSummary {
  const latestIndex = historicoStatsLatest(weeks, values);
  const latestValue = latestIndex >= 0 ? values[latestIndex] : null;
  const latest = latestValue === null ? null : { date: weeks[latestIndex], value: latestValue };
  const yearAgo = latest ? historicoStatsYearAgo(weeks, values, latestIndex) : null;
  const changePct =
    latest && yearAgo
      ? historicoStatsRoundOneDecimal(((latest.value - yearAgo.value) / yearAgo.value) * PERCENT_FACTOR)
      : null;
  return {
    latest,
    yearAgo,
    changePct,
    ...historicoStatsExtremes(weeks, values),
    yearlyAverages: historicoStatsYearlyAverages(weeks, values),
  };
}

interface HistoricoStatsFuelInfo {
  label: string;
  fuel: HistoryFuel;
  summary: SeriesSummary;
}

function historicoStatsSubject(kind: AreaKind, name: string): string {
  switch (kind) {
    case 'espana':
      return 'En España';
    case 'comunidad':
      return `En ${name}`;
    case 'provincia':
      return `En la provincia de ${name}`;
    case 'marca':
      return `En las gasolineras ${name}`;
  }
}

function historicoStatsDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function historicoStatsJoin(parts: string[]): string {
  return parts.join(' y ');
}

function historicoStatsCurrentSentence(subject: string, infos: HistoricoStatsFuelInfo[]): string {
  const parts = infos.flatMap((info) =>
    info.summary.latest
      ? [
          `${info.label} cuesta de media ${formatMilliEuro(info.summary.latest.value)} (${formatIsoDateEs(info.summary.latest.date)})`,
        ]
      : [],
  );
  return `${subject}, ${historicoStatsJoin(parts)}.`;
}

function historicoStatsChangePhrase(changePct: number): string {
  if (changePct === 0) return 'sin variación';
  const direction = changePct > 0 ? 'más' : 'menos';
  return `un ${historicoStatsDecimal(Math.abs(changePct))} % ${direction}`;
}

function historicoStatsYearSentence(infos: HistoricoStatsFuelInfo[]): string | null {
  const parts = infos.flatMap((info) =>
    info.summary.changePct === null
      ? []
      : [`${info.label} cuesta ${historicoStatsChangePhrase(info.summary.changePct)}`],
  );
  if (parts.length === 0) return null;
  return `En comparación con hace un año, ${historicoStatsJoin(parts)}.`;
}

function historicoStatsMaxSentence(infos: HistoricoStatsFuelInfo[]): string | null {
  const parts = infos.flatMap((info) =>
    info.summary.max
      ? [`de ${formatMilliEuro(info.summary.max.value)} el ${formatIsoDateEs(info.summary.max.date)} en ${info.label}`]
      : [],
  );
  if (parts.length === 0) return null;
  const lead = parts.length === 1 ? 'El máximo histórico fue' : 'Los máximos históricos fueron';
  return `${lead} ${historicoStatsJoin(parts)}.`;
}

function historicoStatsSpainCents(
  info: HistoricoStatsFuelInfo,
  weeks: readonly string[],
  spain: AreaHistory,
): string | null {
  const latest = info.summary.latest;
  if (!latest) return null;
  const spainValue = spain.series[info.fuel].avg[weeks.indexOf(latest.date)];
  if (spainValue === null || spainValue === undefined) return null;
  const cents = (latest.value - spainValue) / MILLIS_PER_CENT;
  const rounded = historicoStatsRoundOneDecimal(cents);
  if (rounded === 0) return `${info.label} está en la media nacional`;
  const direction = rounded > 0 ? 'por encima' : 'por debajo';
  return `${info.label} está ${historicoStatsDecimal(Math.abs(rounded))} céntimos ${direction} de la media nacional`;
}

function historicoStatsSpainSentence(
  infos: HistoricoStatsFuelInfo[],
  weeks: readonly string[],
  spain: AreaHistory,
): string | null {
  const parts = infos.flatMap((info) => {
    const part = historicoStatsSpainCents(info, weeks, spain);
    return part === null ? [] : [part];
  });
  if (parts.length === 0) return null;
  return `En la última semana, ${historicoStatsJoin(parts)}.`;
}

/**
 * Párrafo introductorio por área, en español, con cifras de gasolina 95 y diésel
 * (actual, variación anual, máximo con fecha) y, si el área no es España, la
 * comparación con la media nacional.
 */
export function buildAreaIntro(area: AreaHistory, weeks: readonly string[], spain: AreaHistory | null): string {
  const subject = historicoStatsSubject(area.kind, area.name);
  const infos = HISTORICO_STATS_INTRO_FUELS.map(({ fuel, label }) => ({
    fuel,
    label,
    summary: summarizeSeries(weeks, area.series[fuel].avg),
  })).filter((info) => info.summary.latest !== null);
  if (infos.length === 0) {
    return `${subject}, todavía no hay datos históricos de precios de carburantes.`;
  }
  const sentences = [
    historicoStatsCurrentSentence(subject, infos),
    historicoStatsYearSentence(infos),
    historicoStatsMaxSentence(infos),
    area.kind !== 'espana' && spain ? historicoStatsSpainSentence(infos, weeks, spain) : null,
  ];
  return sentences.filter((sentence) => sentence !== null).join(' ');
}
