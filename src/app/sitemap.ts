import type { MetadataRoute } from 'next';
import { getMitecoData, getSiteUrl } from '@/lib/miteco';

export const revalidate = 1800;

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

  return entries;
}
