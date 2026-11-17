import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InternalLink } from '@/components/InternalLink';
import { getMitecoData } from '@/lib/mitecoSnapshot';
import { absoluteUrl } from '@/lib/site';
import dynamic from 'next/dynamic';
import {
  calcularTodasLasStats,
  calculateSavings50L,
  formatPrice,
  formatPrice as fp,
} from '@/lib/miteco';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StationCard } from '@/components/StationCard';
import { ClientMapWrapper } from '@/components/ClientMapWrapper';
import { getBreadcrumbSchema } from '@/lib/seo';
import { Fuel, TrendingDown, MapPin, Building2, Navigation } from 'lucide-react';

export const dynamicParams = false;

/** Una página por municipio con gasolineras en la instantánea de MITECO. */
export async function generateStaticParams() {
  const data = await getMitecoData();
  return Array.from(data.municipiosMap.values(), (mun) => ({
    provincia: mun.provinciaSlug,
    municipio: mun.municipioSlug,
  }));
}

interface PageProps {
  params: Promise<{ provincia: string; municipio: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { provincia: provSlug, municipio: munSlug } = await params;
  const data = await getMitecoData();
  const munKey = `${provSlug}:${munSlug}`;
  const munObj = data.municipiosMap.get(munKey);

  if (!munObj || munObj.estaciones.length === 0) {
    return {
      title: 'Municipio no encontrado',
      robots: { index: false, follow: false },
    };
  }

  const canonical = absoluteUrl(`/provincia/${provSlug}/${munSlug}`);
  const stats = calcularTodasLasStats(munObj.estaciones);
  const minG95 = stats.gasolina95.min;
  const minDiesel = stats.diesel.min;

  const title = `Gasolineras más baratas en ${munObj.municipio} hoy (${munObj.provincia}) | Precios MITECO`;
  const description = `Consulta las gasolineras más baratas en ${munObj.municipio} (${munObj.provincia}) hoy. Compara ${munObj.estaciones.length} estaciones con precios oficiales: Gasolina 95 desde ${formatPrice(minG95)} y diésel desde ${formatPrice(minDiesel)}.`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      siteName: 'Gasolineras España',
    },
  };
}

export default async function MunicipioPage({ params }: PageProps) {
  const { provincia: provSlug, municipio: munSlug } = await params;
  const data = await getMitecoData();
  const munKey = `${provSlug}:${munSlug}`;
  const munObj = data.municipiosMap.get(munKey);

  if (!munObj || munObj.estaciones.length === 0) {
    notFound();
  }

  const provObj = data.provinciasMap.get(provSlug);
  const statsMun = calcularTodasLasStats(munObj.estaciones);
  const statsProv = provObj ? calcularTodasLasStats(provObj.estaciones) : statsMun;

  const minG95Mun = statsMun.gasolina95.min;
  const avgG95Mun = statsMun.gasolina95.avg;
  const minDieselMun = statsMun.diesel.min;
  const avgDieselMun = statsMun.diesel.avg;

  const avgG95Prov = statsProv.gasolina95.avg;
  const avgDieselProv = statsProv.diesel.avg;

  const savingsG95Mun = calculateSavings50L(minG95Mun, avgG95Mun);
  const savingsDieselMun = calculateSavings50L(minDieselMun, avgDieselMun);

  // Tabla ordenada por precio de Gasolina 95 (o Diésel si no tiene)
  const sortedStations = [...munObj.estaciones].sort((a, b) => {
    const pA = a.precios.gasolina95 ?? a.precios.diesel ?? 999;
    const pB = b.precios.gasolina95 ?? b.precios.diesel ?? 999;
    return pA - pB;
  });

  // Municipios cercanos de la misma provincia (con gasolineras)
  const nearbyMunicipios = provObj
    ? Array.from(
        new Set(
          provObj.estaciones
            .filter((s) => s.municipioSlug !== munSlug)
            .map((s) => ({ slug: s.municipioSlug, name: s.municipio }))
        )
      )
        .filter((v, i, a) => a.findIndex((t) => t.slug === v.slug) === i)
        .slice(0, 12)
    : [];

  const breadcrumbs = [
    { label: munObj.provincia, href: `/provincia/${provSlug}` },
    { label: munObj.municipio, href: `/provincia/${provSlug}/${munSlug}` },
  ];

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Inicio', url: absoluteUrl('/') },
    { name: munObj.provincia, url: absoluteUrl(`/provincia/${provSlug}`) },
    { name: munObj.municipio, url: absoluteUrl(`/provincia/${provSlug}/${munSlug}`) },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={breadcrumbs} />

        {/* Encabezado y Resumen Real del Municipio */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-[var(--orange-primary)] uppercase tracking-wider block mb-2">
              {munObj.provincia} &bull; Comparador Municipal
            </span>
            <h1 className="text-xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)]">
              Gasolineras más baratas en <span className="text-[var(--orange-primary)]">{munObj.municipio}</span> hoy
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
              En <strong>{munObj.municipio}</strong> operan actualmente <strong>{munObj.estaciones.length} gasolineras</strong>.
              El precio medio en el término municipal es de <strong>{formatPrice(avgG95Mun)}</strong> en Gasolina 95
              {avgG95Prov && (
                <span> (frente a <strong>{formatPrice(avgG95Prov)}</strong> de la media provincial)</span>
              )}
              {' '}y de <strong>{formatPrice(avgDieselMun)}</strong> en Diésel (Gasóleo A)
              {avgDieselProv && (
                <span> (media en {munObj.provincia}: <strong>{formatPrice(avgDieselProv)}</strong>)</span>
              )}.
            </p>
          </div>

          {/* Cifras Reales Clave Municipales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-[var(--border-subtle)]">
            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Más Barata Gasolina 95</div>
              <div className="font-mono text-xl md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
                {formatPrice(minG95Mun)}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                Media local: {formatPrice(avgG95Mun)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Más Barata Diésel</div>
              <div className="font-mono text-xl md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
                {formatPrice(minDieselMun)}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                Media local: {formatPrice(avgDieselMun)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Ahorro Depósito 50L (G95)</div>
              <div className="font-mono text-xl md:text-2xl font-extrabold text-emerald-500 mt-1">
                {savingsG95Mun !== null ? `+${savingsG95Mun.toFixed(2)} €` : '--'}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">en {munObj.municipio}</div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Ahorro Depósito 50L (Diésel)</div>
              <div className="font-mono text-xl md:text-2xl font-extrabold text-emerald-500 mt-1">
                {savingsDieselMun !== null ? `+${savingsDieselMun.toFixed(2)} €` : '--'}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">en {munObj.municipio}</div>
            </div>
          </div>
        </div>

        {/* Tabla Ordenada por Precio (Indexable y legible sin JS) */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">
                Tabla comparativa de gasolineras en {munObj.municipio}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Ordenadas por el precio más económico. Haz clic en el nombre de la estación para ver su ficha completa y evolución.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[var(--orange-primary)]">
              {munObj.estaciones.length} estaciones
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase tracking-wider font-extrabold">
                  <th className="py-2 px-2 sm:px-3">Estación / Marca</th>
                  <th className="hidden md:table-cell py-2 px-2 sm:px-3">Dirección</th>
                  <th className="py-2 px-2 sm:px-3 text-right">Gasolina 95</th>
                  <th className="py-2 px-2 sm:px-3 text-right">Diésel (A)</th>
                  <th className="hidden lg:table-cell py-2 px-2 sm:px-3">Horario</th>
                  <th className="py-2 px-2 sm:px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {sortedStations.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                    <td className="py-2 px-2 sm:px-3">
                      <InternalLink
                        href={`/gasolinera/${s.id}-${s.slug}`}
                        className="font-bold text-[var(--text-main)] hover:text-[var(--orange-primary)] transition-colors block text-sm"
                      >
                        {s.rotulo}
                      </InternalLink>
                      {idx === 0 && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-[9px] font-extrabold uppercase">
                          MÁS BARATA
                        </span>
                      )}
                    </td>
                    <td className="hidden md:table-cell py-2 px-2 sm:px-3 text-[var(--text-muted)] max-w-xs truncate">
                      {s.direccion}
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-right font-mono font-extrabold text-sm text-[var(--orange-primary)]">
                      {formatPrice(s.precios.gasolina95)}
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-right font-mono font-extrabold text-sm text-[var(--text-main)]">
                      {formatPrice(s.precios.diesel)}
                    </td>
                    <td className="hidden lg:table-cell py-2 px-2 sm:px-3 text-[var(--text-dim)]">
                      {s.horario}
                    </td>
                    <td className="py-2 px-2 sm:px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <InternalLink
                          href={`/gasolinera/${s.id}-${s.slug}`}
                          className="inline-flex items-center min-h-10 px-3 rounded bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-[var(--text-main)] text-[11px] font-semibold transition-colors"
                        >
                          Ficha
                        </InternalLink>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center min-h-10 px-3 rounded bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-[11px] font-bold hover:bg-[var(--on-accent-hover)] transition-colors"
                          title="Ruta en Google Maps"
                        >
                          Ruta
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tarjetas Visuales de las Gasolineras del Municipio */}
        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">
            Detalle de estaciones en {munObj.municipio}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedStations.map((s, idx) => (
              <StationCard key={s.id} station={s} selectedFuel="gasolina95" isCheapest={idx === 0} />
            ))}
          </div>
        </div>

        {/* Mapa Municipal (Cliente con Leaflet) */}
        <div className="space-y-3">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">
            Mapa de gasolineras en {munObj.municipio}
          </h2>
          <ClientMapWrapper
            stations={munObj.estaciones}
            selectedFuel="gasolina95"
            initialCenter={[munObj.estaciones[0].lat, munObj.estaciones[0].lon]}
            initialZoom={13}
          />
        </div>

        {/* Municipios Cercanos de la Misma Provincia (Enlaces Internos) */}
        {nearbyMunicipios.length > 0 && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--orange-primary)]" />
              <span>Otros municipios con gasolineras en {munObj.provincia}</span>
            </h2>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {nearbyMunicipios.map((nm) => (
                <InternalLink
                  key={nm.slug}
                  href={`/provincia/${provSlug}/${nm.slug}`}
                  className="flex items-center min-h-10 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all text-xs font-semibold text-[var(--text-main)] hover:text-[var(--orange-primary)]"
                >
                  <span className="truncate">{nm.name}</span>
                </InternalLink>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
