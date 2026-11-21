import type { MetadataRoute } from 'next';
import { getMitecoData } from '@/lib/mitecoSnapshot';
import { absoluteUrl } from '@/lib/site';
import { getHistoryIndex } from '@/lib/historico';
import { buildHistoricoPath } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';

const SITEMAP_HISTORICO_SPAIN_PRIORITY = 0.7;
const SITEMAP_HISTORICO_AREA_PRIORITY = 0.6;
const SITEMAP_HOME_PRIORITY = 1.0;
const SITEMAP_PROVINCE_PRIORITY = 0.9;
const SITEMAP_MUNICIPALITY_PRIORITY = 0.8;
const SITEMAP_STATION_PRIORITY = 0.6;

/** URLs del histórico desde el índice; vacío si todavía no se ha generado o no se puede leer. */
function sitemapHistoricoEntries(): MetadataRoute.Sitemap {
  try {
    const index = getHistoryIndex();
    if (!index || index.weeks.length === 0) return [];
    const lastModified = new Date(index.weeks[index.weeks.length - 1]);
    return index.areas.map((area) => ({
      url: absoluteUrl(buildHistoricoPath(area.kind, area.slug)),
      lastModified,
      changeFrequency: 'weekly',
      priority: area.kind === 'espana' ? SITEMAP_HISTORICO_SPAIN_PRIORITY : SITEMAP_HISTORICO_AREA_PRIORITY,
    }));
  } catch (err) {
    console.error('Error leyendo el índice del histórico para el sitemap:', err);
    return [];
  }
}

function parseMitecoDate(str?: string): Date {
  if (!str) return new Date();
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return new Date();
  const [, day, month, year, h = '00', m = '00', s = '00'] = match;
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s)));
  return isNaN(d.getTime()) ? new Date() : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getMitecoData();
  const lastModified = parseMitecoDate(data.fechaMiteco);

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified, changeFrequency: 'daily', priority: SITEMAP_HOME_PRIORITY },
  ];

  for (const prov of data.provinciasMap.values()) {
    entries.push({
      url: absoluteUrl(`/provincia/${prov.provinciaSlug}`),
      lastModified,
      changeFrequency: 'daily',
      priority: SITEMAP_PROVINCE_PRIORITY,
    });
  }

  for (const mun of data.municipiosMap.values()) {
    entries.push({
      url: absoluteUrl(`/provincia/${mun.provinciaSlug}/${mun.municipioSlug}`),
      lastModified,
      changeFrequency: 'daily',
      priority: SITEMAP_MUNICIPALITY_PRIORITY,
    });
  }

  for (const station of data.estaciones) {
    entries.push({
      url: absoluteUrl(`/gasolinera/${station.id}-${station.slug}`),
      lastModified,
      changeFrequency: 'daily',
      priority: SITEMAP_STATION_PRIORITY,
    });
  }

  entries.push(...sitemapHistoricoEntries());
  return entries;
}
