import type { Metadata } from 'next';
import type { AreaHistory, AreaHistoryFile, AreaKind } from './historicoFormat';
import { yearOfIso } from './historicoFormat';
import { formatIsoDateEs, formatMilliEuro, summarizeSeries } from './historicoStats';
import { loadAreaHistory } from './historico';
import { getSiteUrl } from './miteco';
import { SECTION_NAME } from './site';

const HISTORICO_BASE_PATH = '/historico';
const HISTORICO_NOT_FOUND_TITLE = 'Histórico de precios no encontrado';
const HISTORICO_EMPTY_TITLE = 'Histórico de precios de carburantes';
const HISTORICO_EMPTY_DESCRIPTION = 'El histórico de precios de carburantes todavía no se ha generado.';
const HISTORICO_DESCRIPTION_TAIL = 'Gráfica semanal con datos oficiales de MITECO.';

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

function historicoSignedPercent(changePct: number): string {
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(1).replace('.', ',')}`;
}

function historicoMilliNumber(milli: number): string {
  return formatMilliEuro(milli).replace(' €/l', '');
}

function historicoPriceSentence(fuelLabel: string, area: AreaHistory, weeks: readonly string[], fuel: 'gasolina95' | 'diesel'): string | null {
  const { latest, changePct } = summarizeSeries(weeks, area.series[fuel].avg);
  if (!latest) return null;
  const change = changePct === null ? '' : ` (${historicoSignedPercent(changePct)} % en un año)`;
  return `${fuelLabel} a ${historicoMilliNumber(latest.value)} €/l${change}`;
}

function historicoMaxSentence(area: AreaHistory, weeks: readonly string[]): string | null {
  const { max } = summarizeSeries(weeks, area.series.gasolina95.avg);
  if (!max) return null;
  return `Máximo histórico ${historicoMilliNumber(max.value)} €/l el ${formatIsoDateEs(max.date)}.`;
}

/** Descripción con las cifras actuales de gasolina 95 y diésel y el máximo histórico de gasolina 95. */
export function buildHistoricoDescription(area: AreaHistory, weeks: readonly string[]): string {
  const prices = [
    historicoPriceSentence('Gasolina 95', area, weeks, 'gasolina95'),
    historicoPriceSentence('diésel', area, weeks, 'diesel'),
  ].filter((part) => part !== null);
  const parts = [prices.length > 0 ? `${prices.join(' y ')}.` : null, historicoMaxSentence(area, weeks), HISTORICO_DESCRIPTION_TAIL];
  return parts.filter((part) => part !== null).join(' ');
}

function historicoNoIndexMetadata(title: string, description?: string): Metadata {
  return { title, description, robots: { index: false, follow: false } };
}

/** Metadatos (título, descripción, canonical absoluto y Open Graph) de la página de histórico de un área. */
export function buildHistoricoMetadata(kind: AreaKind, slug: string): Metadata {
  const file: AreaHistoryFile | null = loadAreaHistory(kind, slug);
  if (!file) {
    return kind === 'espana'
      ? historicoNoIndexMetadata(HISTORICO_EMPTY_TITLE, HISTORICO_EMPTY_DESCRIPTION)
      : historicoNoIndexMetadata(HISTORICO_NOT_FOUND_TITLE);
  }
  const title = buildHistoricoTitle(kind, file.area.name, file.weeks);
  const description = buildHistoricoDescription(file.area, file.weeks);
  const canonical = `${getSiteUrl()}${buildHistoricoPath(kind, slug)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description, siteName: SECTION_NAME },
  };
}
