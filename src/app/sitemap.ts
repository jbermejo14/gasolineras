import type { MetadataRoute } from 'next';
import { getMitecoData, getSiteUrl } from '@/lib/miteco';
import { getHistoryIndex } from '@/lib/historico';
import { buildHistoricoPath } from '@/lib/historicoPageMeta';

export const revalidate = 1800;

const SITEMAP_HISTORICO_SPAIN_PRIORITY = 0.7;
const SITEMAP_HISTORICO_AREA_PRIORITY = 0.6;

/** URLs del histórico desde el índice; vacío si todavía no se ha generado o no se puede leer. */
function sitemapHistoricoEntries(siteUrl: string): MetadataRoute.Sitemap {
  try {
    const index = getHistoryIndex();
    if (!index || index.weeks.length === 0) return [];
    const lastModified = new Date(index.weeks[index.weeks.length - 1]);
    return index.areas.map((area) => ({
      url: `${siteUrl}${buildHistoricoPath(area.kind, area.slug)}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: area.kind === 'espana' ? SITEMAP_HISTORICO_SPAIN_PRIORITY : SITEMAP_HISTORICO_AREA_PRIORITY,
    }));
  } catch (err) {
    console.error('Error leyendo el índice del histórico para el sitemap:', err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
  ];

  try {
    const data = await getMitecoData();

    // 1. Provincias (52)
    for (const prov of data.provinciasMap.values()) {
      entries.push({
        url: `${siteUrl}/provincia/${prov.provinciaSlug}`,
        lastModified: now,
        changeFrequency: 'hourly',
        priority: 0.9,
      });
    }

    // 2. Municipios con gasolineras (~3.800)
    for (const mun of data.municipiosMap.values()) {
      entries.push({
        url: `${siteUrl}/provincia/${mun.provinciaSlug}/${mun.municipioSlug}`,
        lastModified: now,
        changeFrequency: 'hourly',
        priority: 0.8,
      });
    }

    // 3. Fichas individuales de gasolineras (~11.500)
    for (const s of data.estaciones) {
      entries.push({
        url: `${siteUrl}/gasolinera/${s.id}-${s.slug}`,
        lastModified: now,
        changeFrequency: 'hourly',
        priority: 0.6,
      });
    }
  } catch (err) {
    console.error('Error generating sitemap:', err);
  }

  entries.push(...sitemapHistoricoEntries(siteUrl));

  return entries;
}
