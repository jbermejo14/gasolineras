import type { Metadata } from 'next';
import type { AreaHistory, AreaHistoryFile, AreaKind, HistoryFuel } from './historicoFormat';
import { yearOfIso } from './historicoFormat';
import { formatIsoDateEs, formatMilliNumber, formatSignedPercent, summarizeSeries } from './historicoStats';
import { loadAreaHistory } from './historico';
import { absoluteUrl } from './site';
import { buildSocialMetadata } from './socialMetadata';
import { fitDescription, joinSentences, pickTitle, shortPlaceName } from './seoText';

const HISTORICO_BASE_PATH = '/historico';
const HISTORICO_NOT_FOUND_TITLE = 'Histórico de precios no encontrado';
const HISTORICO_EMPTY_TITLE = 'Histórico de precios de carburantes';
const HISTORICO_EMPTY_DESCRIPTION = 'El histórico de precios de carburantes todavía no se ha generado.';
const HISTORICO_DESCRIPTION_TAIL = 'Gráfica semanal con datos oficiales de MITECO.';
const HISTORICO_DESCRIPTION_WEEKLY = 'Series semanales desde 2016.';
const HISTORICO_SPAIN_PAGE_TITLE = 'Precio histórico de gasolina y diésel en España';

/** Ruta de la página de histórico de un área ('/historico' para España). */
export function buildHistoricoPath(kind: AreaKind, slug: string): string {
  return kind === 'espana' ? HISTORICO_BASE_PATH : `${HISTORICO_BASE_PATH}/${kind}/${slug}`;
}

/** Título único por tipo de área, con el rango de años en España. */
export function buildHistoricoTitle(kind: AreaKind, name: string, weeks: readonly string[]): string {
  switch (kind) {
    case 'espana':
      return `Precio histórico de la gasolina y el diésel en España (${yearOfIso(weeks[0])}-${yearOfIso(weeks[weeks.length - 1])})`;
    case 'comunidad':
      return `Evolución del precio de la gasolina y el diésel en ${name} desde ${yearOfIso(weeks[0])}`;
    case 'provincia':
      return `Precio histórico de la gasolina y el diésel en ${name} desde ${yearOfIso(weeks[0])}`;
    case 'marca':
      return `Evolución del precio de la gasolina en ${name} desde ${yearOfIso(weeks[0])}`;
  }
}

function historicoPriceSentence(
  fuelLabel: string,
  area: AreaHistory,
  weeks: readonly string[],
  fuel: HistoryFuel,
  withChange: boolean
): string | null {
  const { latest, changePct } = summarizeSeries(weeks, area.series[fuel].avg);
  if (!latest) return null;
  const change = withChange && changePct !== null ? ` (${formatSignedPercent(changePct)} en un año)` : '';
  return `${fuelLabel} a ${formatMilliNumber(latest.value)} €/l${change}`;
}

function historicoMaxSentence(area: AreaHistory, weeks: readonly string[]): string | null {
  const { max } = summarizeSeries(weeks, area.series.gasolina95.avg);
  if (!max) return null;
  return `Máximo histórico ${formatMilliNumber(max.value)} €/l el ${formatIsoDateEs(max.date)}.`;
}

function historicoPricesText(area: AreaHistory, weeks: readonly string[], withChange: boolean): string | null {
  const prices = [
    historicoPriceSentence('Gasolina 95', area, weeks, 'gasolina95', withChange),
    historicoPriceSentence('diésel', area, weeks, 'diesel', withChange),
  ].filter((part) => part !== null);
  return prices.length > 0 ? `${prices.join(' y ')}.` : null;
}

/** Título (sin marca) de la página de un área para <title>: cabe en 65 caracteres con « | Ododex ». */
export function buildHistoricoPageTitle(kind: AreaKind, name: string, weeks: readonly string[]): string {
  if (kind === 'espana') return HISTORICO_SPAIN_PAGE_TITLE;
  const since = yearOfIso(weeks[0]);
  const short = shortPlaceName(name);
  const subject = kind === 'marca' ? 'de la gasolina' : 'de gasolina y diésel';
  return (
    pickTitle(
      [
        `Precio histórico ${subject} en ${name} desde ${since}`,
        `Precio histórico ${subject} en ${name}`,
        `Histórico ${subject} en ${name}`,
      ],
      [`Histórico de precios en ${name}`, `Histórico de precios en ${short}`]
    ) ?? `Histórico ${short}`
  );
}

/** Descripción (120-160 caracteres) con las cifras actuales de gasolina 95 y diésel y el máximo histórico de gasolina 95. */
export function buildHistoricoDescription(area: AreaHistory, weeks: readonly string[]): string {
  const head = `Precio histórico de los carburantes en ${area.name}:`;
  const max = historicoMaxSentence(area, weeks);
  const variant = (withChange: boolean, withMax: boolean, withTail: boolean) =>
    joinSentences(
      head,
      historicoPricesText(area, weeks, withChange),
      withMax && max,
      withTail && HISTORICO_DESCRIPTION_TAIL
    );
  return fitDescription(
    [
      variant(true, true, true),
      variant(false, true, true),
      variant(true, true, false),
      variant(false, true, false),
      variant(true, false, true),
      variant(false, false, true),
      variant(false, false, false),
    ],
    [HISTORICO_DESCRIPTION_TAIL, HISTORICO_DESCRIPTION_WEEKLY]
  );
}

function historicoNoIndexMetadata(title: string, description?: string): Metadata {
  return { title, description, robots: { index: false, follow: false } };
}

/** Metadatos (título, descripción, canonical absoluto, Open Graph y Twitter) de la página de histórico de un área. */
export function buildHistoricoMetadata(kind: AreaKind, slug: string): Metadata {
  const file: AreaHistoryFile | null = loadAreaHistory(kind, slug);
  if (!file) {
    return kind === 'espana'
      ? historicoNoIndexMetadata(HISTORICO_EMPTY_TITLE, HISTORICO_EMPTY_DESCRIPTION)
      : historicoNoIndexMetadata(HISTORICO_NOT_FOUND_TITLE);
  }
  const title = buildHistoricoPageTitle(kind, file.area.name, file.weeks);
  const description = buildHistoricoDescription(file.area, file.weeks);
  const path = buildHistoricoPath(kind, slug);
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    ...buildSocialMetadata({ title, description, path }),
  };
}
