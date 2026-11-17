import Link from 'next/link';
import { getMitecoData, getSiteUrl, calculateSavings50L, formatPrice } from '@/lib/miteco';
import { InteractiveGasFinder } from '@/components/InteractiveGasFinder';
import { getBreadcrumbSchema } from '@/lib/seo';
import { TrendingDown, MapPin, Fuel, ShieldCheck } from 'lucide-react';

export const revalidate = 1800; // 30 minutos

export default async function HomePage() {
  const data = await getMitecoData();
  const siteUrl = getSiteUrl();

  const g95Stats = data.statsNacionales.gasolina95;
  const dieselStats = data.statsNacionales.diesel;
  const savingsG95 = calculateSavings50L(g95Stats.min, g95Stats.avg);
  const savingsDiesel = calculateSavings50L(dieselStats.min, dieselStats.avg);

  // Lista de provincias ordenadas
  const provincesList = Array.from(data.provinciasMap.values())
    .map((p) => ({
      slug: p.provinciaSlug,
      name: p.provincia,
      count: p.estaciones.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // Breadcrumbs Schema
  const breadcrumbSchema = getBreadcrumbSchema([{ name: 'Inicio', url: siteUrl }]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="space-y-8">
        {/* Hero Section */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--orange-subtle)] border border-[var(--orange-border)] text-xs font-bold text-[var(--orange-primary)] mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Datos verificados del Ministerio para la Transición Ecológica</span>
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)] leading-tight">
              Precios de Gasolineras en España <span className="text-[var(--orange-primary)]">Hoy en Directo</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
              Monitoreamos en tiempo real las <strong>{data.estaciones.length.toLocaleString('es-ES')} estaciones de servicio</strong> activas
              en las 52 provincias españolas. Compara precios por provincia y municipio para ahorrar en cada repostaje.
            </p>
          </div>

          {/* Cifras Reales Clave Nacionales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium flex items-center justify-between">
                <span>Gasolina 95 Mínima</span>
                <Fuel className="w-4 h-4 text-[var(--orange-primary)]" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
                {formatPrice(g95Stats.min)}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">Media nacional: {formatPrice(g95Stats.avg)}</div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium flex items-center justify-between">
                <span>Diésel (Gasóleo A) Mínimo</span>
                <Fuel className="w-4 h-4 text-[var(--orange-primary)]" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
                {formatPrice(dieselStats.min)}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">Media nacional: {formatPrice(dieselStats.avg)}</div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium flex items-center justify-between">
                <span>Ahorro Gasolina 95 (50L)</span>
                <TrendingDown className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-500 mt-1">
                {savingsG95 !== null ? `+${savingsG95.toFixed(2)} €` : '--'}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">frente al promedio nacional</div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-muted)] font-medium flex items-center justify-between">
                <span>Ahorro Diésel (50L)</span>
                <TrendingDown className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-500 mt-1">
                {savingsDiesel !== null ? `+${savingsDiesel.toFixed(2)} €` : '--'}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">frente al promedio nacional</div>
            </div>
          </div>
        </div>

        {/* Buscador Interactivo y Mapa Nacional */}
        <InteractiveGasFinder
          provinces={provincesList}
          statsNacionales={data.statsNacionales}
        />

        {/* Directorio de Provincias para SEO Indexable */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--text-main)]">
                Directorio de Gasolineras por Provincia
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Selecciona una provincia para ver las estaciones más baratas, medias provinciales y lista completa de municipios.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--orange-primary)]">
              {provincesList.length} Provincias
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
            {provincesList.map((p) => (
              <Link
                key={p.slug}
                href={`/provincia/${p.slug}`}
                className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-between group"
              >
                <span className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--orange-primary)] transition-colors line-clamp-1">
                  {p.name}
                </span>
                <span className="text-[11px] text-[var(--text-dim)] font-mono mt-1">
                  {p.count} estaciones
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
