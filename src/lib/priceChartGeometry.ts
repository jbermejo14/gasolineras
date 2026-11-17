import { yearOfIso } from './historicoFormat.ts';
import type { FuelSeries, HistoryFuel, PriceMilli } from './historicoFormat.ts';

export interface ChartInput {
  weeks: readonly string[];
  series: readonly { fuel: HistoryFuel; values: FuelSeries }[];
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ChartGeometry {
  /** Los null cortan la línea (nuevo "M"). */
  paths: { fuel: HistoryFuel; d: string }[];
  yTicks: { value: PriceMilli; y: number; label: string }[];
  /** Años, o meses si el rango es menor de 18 meses. */
  xTicks: { label: string; x: number }[];
  /** Índice de semana más cercano a una x de pantalla (en coordenadas del viewBox). */
  indexAtX(x: number): number;
  pointAt(index: number, fuel: HistoryFuel): { x: number; y: number } | null;
}

/** Pasos "redondos" del eje Y, en milésimas de euro (0,05 / 0,10 / 0,20 / 0,50 / 1,00 €). */
const PRICE_CHART_Y_STEPS: readonly number[] = [50, 100, 200, 500, 1000];
const PRICE_CHART_MIN_Y_TICKS = 4;
const PRICE_CHART_MAX_Y_TICKS = 6;
/** Dominio del eje Y cuando no hay ningún dato (1,00 € a 2,00 €). */
const PRICE_CHART_EMPTY_DOMAIN: readonly [PriceMilli, PriceMilli] = [1000, 2000];
const PRICE_CHART_MONTH_RANGE_LIMIT = 18;
const PRICE_CHART_MONTHS_PER_YEAR = 12;
/** Separación mínima en píxeles entre etiquetas del eje X para que no se pisen. */
const PRICE_CHART_MIN_X_TICK_GAP = 30;
const PRICE_CHART_MILLIS_PER_EURO = 1000;
const PRICE_CHART_COORD_DECIMALS = 2;
const PRICE_CHART_MONTH_LABELS: readonly string[] = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** Formatea milésimas de euro como "1,50 €". */
export function formatPriceLabel(value: PriceMilli): string {
  const euros = (value / PRICE_CHART_MILLIS_PER_EURO).toFixed(2);
  return `${euros.replace('.', ',')} €`;
}

interface PriceChartYDomain {
  min: PriceMilli;
  max: PriceMilli;
  step: number;
}

function priceChartValueRange(
  series: ChartInput['series']
): { low: PriceMilli; high: PriceMilli } | null {
  let low = Infinity;
  let high = -Infinity;
  for (const { values } of series) {
    for (const value of values) {
      if (value === null) continue;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }
  return low === Infinity ? null : { low, high };
}

function priceChartDomainForStep(low: number, high: number, step: number): PriceChartYDomain {
  return { min: Math.floor(low / step) * step, max: Math.ceil(high / step) * step, step };
}

/** Amplía el dominio hasta tener al menos el mínimo de marcas (rango casi plano). */
function priceChartEnsureMinTicks(domain: PriceChartYDomain): PriceChartYDomain {
  let { min, max } = domain;
  let addTop = true;
  while ((max - min) / domain.step + 1 < PRICE_CHART_MIN_Y_TICKS) {
    if (addTop || min - domain.step < 0) max += domain.step;
    else min -= domain.step;
    addTop = !addTop;
  }
  return { min, max, step: domain.step };
}

function priceChartYDomain(series: ChartInput['series']): PriceChartYDomain {
  const range = priceChartValueRange(series);
  const [low, high] = range ? [range.low, range.high] : PRICE_CHART_EMPTY_DOMAIN;
  for (const step of PRICE_CHART_Y_STEPS) {
    const domain = priceChartDomainForStep(low, high, step);
    if ((domain.max - domain.min) / step + 1 <= PRICE_CHART_MAX_Y_TICKS) {
      return priceChartEnsureMinTicks(domain);
    }
  }
  const lastStep = PRICE_CHART_Y_STEPS[PRICE_CHART_Y_STEPS.length - 1];
  return priceChartDomainForStep(low, high, lastStep);
}

function priceChartRound(value: number): string {
  return value.toFixed(PRICE_CHART_COORD_DECIMALS);
}

function priceChartPathData(points: ({ x: number; y: number } | null)[]): string {
  let d = '';
  let drawing = false;
  for (const point of points) {
    if (point === null) {
      drawing = false;
      continue;
    }
    d += `${drawing ? 'L' : 'M'}${priceChartRound(point.x)} ${priceChartRound(point.y)} `;
    drawing = true;
  }
  return d.trim();
}

function priceChartMonthIndex(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

/** Semanas en las que cambia el mes (o el año) respecto a la anterior; la primera siempre cuenta. */
function priceChartPeriodStarts(weeks: readonly string[], useMonths: boolean): number[] {
  const starts: number[] = [];
  let previousKey = '';
  weeks.forEach((week, index) => {
    const key = useMonths ? week.slice(0, 7) : String(yearOfIso(week));
    if (key !== previousKey) starts.push(index);
    previousKey = key;
  });
  return starts;
}

function priceChartXLabel(week: string, useMonths: boolean): string {
  return useMonths ? PRICE_CHART_MONTH_LABELS[priceChartMonthIndex(week)] : String(yearOfIso(week));
}

function priceChartUsesMonths(weeks: readonly string[]): boolean {
  if (weeks.length === 0) return false;
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const months =
    (yearOfIso(last) - yearOfIso(first)) * PRICE_CHART_MONTHS_PER_YEAR +
    (priceChartMonthIndex(last) - priceChartMonthIndex(first));
  return months < PRICE_CHART_MONTH_RANGE_LIMIT;
}

function priceChartBuildXTicks(
  weeks: readonly string[],
  xOf: (index: number) => number
): ChartGeometry['xTicks'] {
  const useMonths = priceChartUsesMonths(weeks);
  const ticks: ChartGeometry['xTicks'] = [];
  for (const index of priceChartPeriodStarts(weeks, useMonths)) {
    const x = xOf(index);
    const previous = ticks[ticks.length - 1];
    if (previous && x - previous.x < PRICE_CHART_MIN_X_TICK_GAP) continue;
    ticks.push({ label: priceChartXLabel(weeks[index], useMonths), x });
  }
  return ticks;
}

function priceChartAssertSize(input: ChartInput): void {
  const { width, height, padding } = input;
  if (width <= padding.left + padding.right || height <= padding.top + padding.bottom) {
    throw new RangeError(
      `Tamaño de gráfica no válido: ${width}x${height} no deja espacio útil con el relleno indicado.`
    );
  }
}

/** Calcula escalas, líneas y marcas de la gráfica de precios; no toca el DOM. */
export function buildChartGeometry(input: ChartInput): ChartGeometry {
  priceChartAssertSize(input);
  const { weeks, series, width, height, padding } = input;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const lastIndex = weeks.length - 1;
  const domain = priceChartYDomain(series);

  const xOf = (index: number): number =>
    lastIndex <= 0 ? padding.left : padding.left + (index / lastIndex) * innerWidth;
  const yOf = (value: PriceMilli): number =>
    padding.top + ((domain.max - value) / (domain.max - domain.min)) * innerHeight;

  const pointAt: ChartGeometry['pointAt'] = (index, fuel) => {
    const value = series.find((entry) => entry.fuel === fuel)?.values[index];
    if (value === undefined || value === null || index < 0 || index > lastIndex) return null;
    return { x: xOf(index), y: yOf(value) };
  };

  const paths = series.map(({ fuel, values }) => ({
    fuel,
    d: priceChartPathData(weeks.map((_, index) => pointAt(index, fuel))),
  }));

  const yTicks: ChartGeometry['yTicks'] = [];
  for (let value = domain.min; value <= domain.max; value += domain.step) {
    yTicks.push({ value, y: yOf(value), label: formatPriceLabel(value) });
  }

  const indexAtX = (x: number): number => {
    if (lastIndex <= 0) return 0;
    const raw = Math.round(((x - padding.left) / innerWidth) * lastIndex);
    return Math.min(lastIndex, Math.max(0, raw));
  };

  return { paths, yTicks, xTicks: priceChartBuildXTicks(weeks, xOf), indexAtX, pointAt };
}
