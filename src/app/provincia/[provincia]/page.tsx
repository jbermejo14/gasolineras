import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getMitecoData,
  getSiteUrl,
  calcularTodasLasStats,
  calculateSavings50L,
  formatPrice,
  FuelType,
  FUEL_LABELS,
} from '@/lib/miteco';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StationCard } from '@/components/StationCard';
import { getBreadcrumbSchema } from '@/lib/seo';
import { Fuel, TrendingDown, MapPin, Building2 } from 'lucide-react';

export const revalidate = 1800;

interface PageProps {
  params: Promise<{ provincia: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { provincia } = await params;
  const data = await getMitecoData();
  const provObj = data.provinciasMap.get(provincia);

  if (!provObj) {
    return {
      title: 'Provincia no encontrada',
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/provincia/${provincia}`;
  const stats = calcularTodasLasStats(provObj.estaciones);
  const minG95 = stats.gasolina95.min;
  const minDiesel = stats.diesel.min;

  const title = `Gasolineras más baratas en ${provObj.provincia} hoy | Precios MITECO`;
  const description = `Precios de combustible en ${provObj.provincia} hoy: ${provObj.estaciones.length} gasolineras comparadas en directo. Gasolina 95 desde ${formatPrice(minG95)} y diésel desde ${formatPrice(minDiesel)}. Ahorra repostando en tu provincia.`;

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

export default async function ProvinciaPage({ params }: PageProps) {
  const { provincia: provSlug } = await params;
  const data = await getMitecoData();
  const provObj = data.provinciasMap.get(provSlug);

  if (!provObj) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const statsProv = calcularTodasLasStats(provObj.estaciones);
  const natG95 = data.statsNacionales.gasolina95;
  const natDiesel = data.statsNacionales.diesel;

  const minG95 = statsProv.gasolina95.min;
  const avgG95 = statsProv.gasolina95.avg;
  const minDiesel = statsProv.diesel.min;
  const avgDiesel = statsProv.diesel.avg;

  const savingsG95 = calculateSavings50L(minG95, avgG95);
  const savingsDiesel = calculateSavings50L(minDiesel, avgDiesel);

  // Municipios de esta provincia con gasolineras
  const municipiosMap = new Map<string, { slug: string; name: string; count: number }>();
  provObj.estaciones.forEach((s) => {
    if (!municipiosMap.has(s.municipioSlug)) {
      municipiosMap.set(s.municipioSlug, {
        slug: s.municipioSlug,
        name: s.municipio,
        count: 0,
      });
    }
    municipiosMap.get(s.municipioSlug)!.count++;
  });

  const municipiosList = Array.from(municipiosMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // Top más baratas Gasolina 95
  const cheapestG95 = [...provObj.estaciones]
    .filter((s) => s.precios.gasolina95 !== null)
    .sort((a, b) => (a.precios.gasolina95 as number) - (b.precios.gasolina95 as number))
    .slice(0, 6);

  // Top más baratas Diésel
  const cheapestDiesel = [...provObj.estaciones]
    .filter((s) => s.precios.diesel !== null)
    .sort((a, b) => (a.precios.diesel as number) - (b.precios.diesel as number))
    .slice(0, 6);

  const breadcrumbs = [
    { label: provObj.provincia, href: `/provincia/${provSlug}` },
  ];

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Inicio', url: siteUrl },
    { name: provObj.provincia, url: `${siteUrl}/provincia/${provSlug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="space-y-8">
        <Breadcrumbs items={breadcrumbs} />

        {/* Encabezado y Resumen Real */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 md:p-8 shadow-md">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-[var(--orange-primary)] uppercase tracking-wider block mb-2">
              Comunidad y Provincia
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[var(--text-main)]">
              Gasolineras en <span className="text-[var(--orange-primary)]">{provObj.provincia}</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
              En la provincia de <strong>{provObj.provincia}</strong> dispones de <strong>{provObj.estaciones.length} gasolineras</strong> activas
              distribuidas en <strong>{municipiosList.length} municipios</strong>.
              El precio medio provincial se sitúa en <strong>{formatPrice(avgG95)}</strong> para Gasolina 95 y <strong>{formatPrice(avgDiesel)}</strong> para Diésel.
            </p>
          </div>

          {/* Cifras Reales Clave de la Provincia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Mínimo Gasolina 95</div>
              <div className="font-mono text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
                {formatPrice(minG95)}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                Media prov: {formatPrice(avgG95)} (Nac: {formatPrice(natG95.avg)})
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Mínimo Diésel</div>
              <div className="font-mono text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
                {formatPrice(minDiesel)}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                Media prov: {formatPrice(avgDiesel)} (Nac: {formatPrice(natDiesel.avg)})
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Ahorro Depósito 50L (G95)</div>
              <div className="font-mono text-2xl font-extrabold text-emerald-500 mt-1">
                {savingsG95 !== null ? `+${savingsG95.toFixed(2)} €` : '--'}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">frente a la media de {provObj.provincia}</div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Ahorro Depósito 50L (Diésel)</div>
              <div className="font-mono text-2xl font-extrabold text-emerald-500 mt-1">
                {savingsDiesel !== null ? `+${savingsDiesel.toFixed(2)} €` : '--'}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">frente a la media de {provObj.provincia}</div>
            </div>
          </div>
        </div>

        {/* Top Más Baratas Gasolina 95 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Fuel className="w-5 h-5 text-[var(--orange-primary)]" />
              <span>Las más baratas de Gasolina 95 en {provObj.provincia}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cheapestG95.map((s, idx) => (
              <StationCard key={s.id} station={s} selectedFuel="gasolina95" isCheapest={idx === 0} />
            ))}
          </div>
        </div>

        {/* Top Más Baratas Diésel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Fuel className="w-5 h-5 text-[var(--orange-primary)]" />
              <span>Las más baratas de Diésel (Gasóleo A) en {provObj.provincia}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cheapestDiesel.map((s, idx) => (
              <StationCard key={s.id} station={s} selectedFuel="diesel" isCheapest={idx === 0} />
            ))}
          </div>
        </div>

        {/* Directorio de Municipios con Gasolineras */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 md:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[var(--orange-primary)]" />
                <span>Municipios con gasolineras en {provObj.provincia}</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Haz clic en cualquier municipio para ver los precios detallados, mapa municipal y estaciones más económicas.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--orange-primary)]">
              {municipiosList.length} Municipios
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
            {municipiosList.map((m) => (
              <Link
                key={m.slug}
                href={`/provincia/${provSlug}/${m.slug}`}
                className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-between group"
              >
                <span className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--orange-primary)] transition-colors line-clamp-1">
                  {m.name}
                </span>
                <span className="text-[11px] text-[var(--text-dim)] font-mono mt-1">
                  {m.count} {m.count === 1 ? 'estación' : 'estaciones'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
