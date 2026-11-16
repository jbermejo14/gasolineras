import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  getMitecoData,
  getSiteUrl,
  calcularTodasLasStats,
  calculateSavings50L,
  formatPrice,
  FUEL_LABELS,
  FuelType,
} from '@/lib/miteco';
import { getStationBrand } from '@/lib/brands';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ClientMapWrapper } from '@/components/ClientMapWrapper';
import { getBreadcrumbSchema, getGasStationSchema } from '@/lib/seo';
import { Clock, MapPin, Navigation, Fuel, ShieldCheck, ArrowLeft } from 'lucide-react';

export const revalidate = 1800;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) {
    return { title: 'Gasolinera no encontrada', robots: { index: false, follow: false } };
  }

  const id = match[1];
  const data = await getMitecoData();
  const station = data.estacionesById.get(id);

  if (!station) {
    return { title: 'Gasolinera no encontrada', robots: { index: false, follow: false } };
  }

  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/gasolinera/${station.id}-${station.slug}`;

  const pG95 = station.precios.gasolina95 ? formatPrice(station.precios.gasolina95) : null;
  const pDiesel = station.precios.diesel ? formatPrice(station.precios.diesel) : null;

  const title = `Gasolinera ${station.rotulo} en ${station.municipio} (${station.provincia}) | Precios MITECO Hoy`;
  const description = `Consulta los precios hoy en la estación ${station.rotulo} (${station.direccion}, ${station.municipio}): ${
    pG95 ? `Gasolina 95: ${pG95}. ` : ''
  }${pDiesel ? `Diésel: ${pDiesel}. ` : ''}Horario ${station.horario} y cómo llegar con GPS.`;

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

export default async function GasolineraPage({ params }: PageProps) {
  const { slug } = await params;
  const match = slug.match(/^(\d+)-(.*)$/);

  if (!match) {
    notFound();
  }

  const id = match[1];
  const data = await getMitecoData();
  const station = data.estacionesById.get(id);

  if (!station) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const brand = getStationBrand(station.rotulo);
  const munKey = `${station.provinciaSlug}:${station.municipioSlug}`;
  const munObj = data.municipiosMap.get(munKey);
  const provObj = data.provinciasMap.get(station.provinciaSlug);

  const statsMun = munObj ? calcularTodasLasStats(munObj.estaciones) : null;
  const statsProv = provObj ? calcularTodasLasStats(provObj.estaciones) : null;

  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;

  // Todos los combustibles disponibles en esta gasolinera
  const fuelList: FuelType[] = [
    'gasolina95',
    'diesel',
    'dieselPremium',
    'gasolina98',
    'glp',
    'gnc',
    'gnl',
    'dieselB',
    'adblue',
  ];
  const availableFuels = fuelList.filter((f) => station.precios[f] !== null);

  const breadcrumbs = [
    { label: station.provincia, href: `/provincia/${station.provinciaSlug}` },
    { label: station.municipio, href: `/provincia/${station.provinciaSlug}/${station.municipioSlug}` },
    { label: `${station.rotulo} (${station.id})`, href: `/gasolinera/${station.id}-${station.slug}` },
  ];

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Inicio', url: siteUrl },
    { name: station.provincia, url: `${siteUrl}/provincia/${station.provinciaSlug}` },
    { name: station.municipio, url: `${siteUrl}/provincia/${station.provinciaSlug}/${station.municipioSlug}` },
    { name: `${station.rotulo} (${station.id})`, url: `${siteUrl}/gasolinera/${station.id}-${station.slug}` },
  ]);

  const gasStationSchema = getGasStationSchema({
    id: station.id,
    rotulo: station.rotulo,
    direccion: station.direccion,
    cp: station.cp,
    localidad: station.localidad,
    municipio: station.municipio,
    provincia: station.provincia,
    horario: station.horario,
    lat: station.lat,
    lon: station.lon,
    url: `${siteUrl}/gasolinera/${station.id}-${station.slug}`,
    precios: station.precios as unknown as Record<string, number | null>,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gasStationSchema) }}
      />

      <div className="space-y-8">
        <Breadcrumbs items={breadcrumbs} />

        {/* Ficha Principal de la Estación */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 md:p-8 shadow-md">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {brand ? (
                  <div className="inline-flex items-center gap-2 bg-white border border-[var(--border-color)] px-3 py-1.5 rounded-md shadow-xs">
                    <Image
                      src={brand.logo}
                      alt={brand.name}
                      width={48}
                      height={24}
                      className="h-6 w-auto object-contain"
                    />
                    <span className="text-sm font-extrabold text-neutral-900 uppercase tracking-tight">
                      {station.rotulo}
                    </span>
                  </div>
                ) : (
                  <span className="px-3 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--orange-border)] text-[var(--orange-primary)] text-sm font-extrabold uppercase tracking-tight">
                    {station.rotulo}
                  </span>
                )}
                <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-input)] px-2.5 py-1 rounded border border-[var(--border-color)]">
                  IDEESS: {station.id}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-main)]">
                Gasolinera {station.rotulo} en {station.municipio}
              </h1>

              <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[var(--orange-primary)] shrink-0" />
                  <span>
                    <strong>Dirección:</strong> {station.direccion}, {station.cp} {station.municipio} ({station.provincia})
                  </span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[var(--orange-primary)] shrink-0" />
                  <span>
                    <strong>Horario habitual:</strong> {station.horario}
                  </span>
                </p>
                {station.tipoVenta && (
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Tipo de venta: {station.tipoVenta === 'P' ? 'Pública' : station.tipoVenta}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[200px]">
              <a
                href={gmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--orange-primary)] text-black font-extrabold text-sm hover:bg-[var(--orange-hover)] transition-all shadow-md shadow-[var(--orange-glow)]"
              >
                <Navigation className="w-4 h-4" />
                <span>Cómo llegar (GPS)</span>
              </a>
              <Link
                href={`/provincia/${station.provinciaSlug}/${station.municipioSlug}`}
                className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-xs font-bold text-[var(--text-main)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ver todo {station.municipio}</span>
              </Link>
            </div>
          </div>

          {/* Comparativa de Ahorro para un Depósito de 50L */}
          {statsMun && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)] text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium block">
                  Gasolina 95 frente a la media municipal ({formatPrice(statsMun.gasolina95.avg)})
                </span>
                <span className="font-mono text-lg font-bold text-[var(--text-main)] mt-1 block">
                  {station.precios.gasolina95 && statsMun.gasolina95.avg
                    ? station.precios.gasolina95 <= statsMun.gasolina95.avg
                      ? `Ahorras ${((statsMun.gasolina95.avg - station.precios.gasolina95) * 50).toFixed(2)} € por depósito de 50L`
                      : `Cuesta +${((station.precios.gasolina95 - statsMun.gasolina95.avg) * 50).toFixed(2)} € por depósito frente a la media`
                    : 'Sin datos comparativos'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium block">
                  Diésel frente a la media municipal ({formatPrice(statsMun.diesel.avg)})
                </span>
                <span className="font-mono text-lg font-bold text-[var(--text-main)] mt-1 block">
                  {station.precios.diesel && statsMun.diesel.avg
                    ? station.precios.diesel <= statsMun.diesel.avg
                      ? `Ahorras ${((statsMun.diesel.avg - station.precios.diesel) * 50).toFixed(2)} € por depósito de 50L`
                      : `Cuesta +${((station.precios.diesel - statsMun.diesel.avg) * 50).toFixed(2)} € por depósito frente a la media`
                    : 'Sin datos comparativos'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Lista Completa de Precios Registrados Hoy */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Fuel className="w-5 h-5 text-[var(--orange-primary)]" />
              <span>Precios oficiales de carburantes hoy</span>
            </h2>
            <span className="text-xs text-[var(--text-muted)]">Datos MITECO</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableFuels.map((f) => {
              const price = station.precios[f]!;
              return (
                <div
                  key={f}
                  className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-muted)] block">
                      {FUEL_LABELS[f]}
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-[var(--orange-primary)] mt-1 block">
                      {price.toFixed(3)} <span className="text-xs font-normal text-[var(--text-muted)]">€/l</span>
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-[var(--text-dim)] font-mono">
                    50L = {(price * 50).toFixed(2)} €
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mapa con la Ubicación Exacta de la Estación */}
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[var(--orange-primary)]" />
            <span>Ubicación y mapa de acceso</span>
          </h2>
          <ClientMapWrapper
            stations={[station]}
            initialCenter={[station.lat, station.lon]}
            initialZoom={16}
            highlightStationId={station.id}
          />
        </div>
      </div>
    </>
  );
}
