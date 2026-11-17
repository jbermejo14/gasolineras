import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { HistoricoAreaCards } from '@/components/HistoricoAreaCards';
import { HistoricoAreaLinks } from '@/components/HistoricoAreaLinks';
import { HistoricoAreaTable } from '@/components/HistoricoAreaTable';
import { HISTORY_FUELS } from '@/lib/historicoFormat';
import type { AreaHistory, AreaHistoryFile, FuelSeries, HistoryFuel } from '@/lib/historicoFormat';
import { buildHistoricoDescription, buildHistoricoPath, buildHistoricoTitle } from '@/lib/historicoPageMeta';
import { buildAreaIntro, formatIsoDateEs } from '@/lib/historicoStats';
import { absoluteUrl } from '@/lib/site';
import { getBreadcrumbSchema, getDatasetSchema } from '@/lib/seo';

interface HistoricoAreaProps {
  areaFile: AreaHistoryFile;
  spain: AreaHistory | null;
}

const HISTORICO_AREA_LESS_THAN_PATTERN = /</g;
const HISTORICO_AREA_LESS_THAN_ESCAPED = '\\u003c';
const HISTORICO_AREA_HOME_LABEL = 'Histórico de precios';
const HISTORICO_AREA_SPAIN_NAME = 'España';
const HISTORICO_AREA_CARD_CLASS = 'rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm';

/** Serializa el JSON-LD escapando `<` para que un nombre con `</script>` no cierre la etiqueta. */
function historicoAreaSchemaJson(schema: unknown): string {
  return JSON.stringify(schema).replace(HISTORICO_AREA_LESS_THAN_PATTERN, HISTORICO_AREA_LESS_THAN_ESCAPED);
}

function historicoAreaChartSeries(area: AreaHistory): Partial<Record<HistoryFuel, FuelSeries>> {
  return Object.fromEntries(HISTORY_FUELS.map((fuel) => [fuel, area.series[fuel].avg]));
}

function historicoAreaBreadcrumbs(area: AreaHistory) {
  if (area.kind === 'espana') return [{ label: HISTORICO_AREA_HOME_LABEL }];
  return [{ label: HISTORICO_AREA_HOME_LABEL, href: buildHistoricoPath('espana', 'espana') }, { label: area.name }];
}

function historicoAreaSchemas(area: AreaHistory, weeks: readonly string[]) {
  const url = absoluteUrl(buildHistoricoPath(area.kind, area.slug));
  const crumbs = [
    { name: 'Inicio', url: absoluteUrl('/') },
    { name: HISTORICO_AREA_HOME_LABEL, url: absoluteUrl(buildHistoricoPath('espana', 'espana')) },
  ];
  if (area.kind !== 'espana') crumbs.push({ name: area.name, url });
  return [
    getBreadcrumbSchema(crumbs),
    getDatasetSchema({
      name: buildHistoricoTitle(area.kind, area.name, weeks),
      description: buildHistoricoDescription(area, weeks),
      url,
      firstDate: weeks[0],
      lastDate: weeks[weeks.length - 1],
      placeName: area.kind === 'marca' ? HISTORICO_AREA_SPAIN_NAME : area.name,
    }),
  ];
}

/** Plantilla compartida de las páginas de histórico (España, comunidad, provincia y marca). */
export function HistoricoArea({ areaFile, spain }: HistoricoAreaProps) {
  const { area, weeks } = areaFile;

  return (
    <>
      {historicoAreaSchemas(area, weeks).map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: historicoAreaSchemaJson(schema) }} />
      ))}

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={historicoAreaBreadcrumbs(area)} />

        <div className={`${HISTORICO_AREA_CARD_CLASS} shadow-md space-y-4 md:space-y-6`}>
          <div className="max-w-3xl">
            <h1 className="text-xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)]">
              {buildHistoricoTitle(area.kind, area.name, weeks)}
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
              {buildAreaIntro(area, weeks, spain)}
            </p>
          </div>
          <HistoricoAreaCards area={area} weeks={weeks} />
        </div>

        <div className={`${HISTORICO_AREA_CARD_CLASS} min-w-0`}>
          <PriceHistoryChart weeks={weeks} series={historicoAreaChartSeries(area)} title={`Evolución del precio en ${area.name}`}
            defaultRange="all"
          />
        </div>

        <section className={`${HISTORICO_AREA_CARD_CLASS} space-y-4 min-w-0`}>
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">Precio medio por año</h2>
          <HistoricoAreaTable area={area} weeks={weeks} />
        </section>

        <HistoricoAreaLinks kind={area.kind} slug={area.slug} name={area.name} parentSlug={area.parentSlug} />

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Cada punto es el precio medio de todas las gasolineras del área el lunes de esa semana. Fuente: MITECO.
          Último dato: {formatIsoDateEs(weeks[weeks.length - 1])}.
        </p>
      </div>
    </>
  );
}
