import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  calcularTodasLasStats,
  calculateSavings50L,
  formatPrice,
  FUEL_LABELS,
  FuelType,
  type Gasolinera,
} from '@/lib/miteco';
import { getMitecoData } from '@/lib/mitecoSnapshot';
import { absoluteUrl, assetPath, SITE_NAME } from '@/lib/site';
import { formatEuros, formatKm, nearbyStations, stationLabel, stationSummary, TANK_LITERS } from '@/lib/stationInsights';
import { getStationBrand } from '@/lib/brands';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InternalLink } from '@/components/InternalLink';
import { AdSlot } from '@/components/AdSlot';
import { RedLinks } from '@/components/RedLinks';
import { municipalityRedKey } from '@/lib/red';
import { ClientMapWrapper } from '@/components/ClientMapWrapper';
import { StationHistory } from '@/components/StationHistory';
import { getBreadcrumbSchema, getGasStationSchema } from '@/lib/seo';
import { Clock, MapPin, Navigation, Fuel, ShieldCheck, ArrowLeft, LineChart } from 'lucide-react';

export const dynamicParams = false;

/** Ruta interna de la ficha de una gasolinera: /gasolinera/<id>-<slug>. */
function gasolineraStationPath(station: { id: string; slug: string }): string {
  return `/gasolinera/${station.id}-${station.slug}`;
}

/** Una página por gasolinera de la instantánea de MITECO. */
export async function generateStaticParams() {
  const data = await getMitecoData();
  return data.estaciones.map((station) => ({ slug: `${station.id}-${station.slug}` }));
}

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

  const canonical = absoluteUrl(gasolineraStationPath(station));

  const pG95 = station.precios.gasolina95 ? formatPrice(station.precios.gasolina95) : null;
  const pDiesel = station.precios.diesel ? formatPrice(station.precios.diesel) : null;

  const title = `Gasolinera ${station.rotulo} en ${station.municipio}: precios hoy`;
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
      siteName: SITE_NAME,
    },
  };
}

const NEARBY_FUELS: ReadonlyArray<{ fuel: FuelType; label: string }> = [
  { fuel: 'gasolina95', label: 'Gasolina 95' },
  { fuel: 'diesel', label: 'Diésel' },
];

interface NearbyStationItemProps {
  current: Gasolinera;
  near: Gasolinera;
  km: number;
}

/** Una gasolinera cercana, con su distancia, sus precios y una marca donde sale más barata que la actual. */
function NearbyStationItem({ current, near, km }: NearbyStationItemProps) {
  const pricedFuels = NEARBY_FUELS.filter(({ fuel }) => near.precios[fuel] !== null);
  return (
    <li className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] space-y-2 min-w-0">
      <InternalLink
        href={gasolineraStationPath(near)}
        className="block text-sm font-bold text-[var(--text-main)] hover:text-[var(--orange-primary)] break-words"
      >
        {stationLabel(near)}
        {near.municipioSlug !== current.municipioSlug && ` · ${near.municipio}`}
      </InternalLink>
      <p className="text-xs text-[var(--text-muted)]">a {formatKm(km)}</p>
      {pricedFuels.length > 0 && (
        <ul className="space-y-1 text-xs font-mono text-[var(--text-main)]">
          {pricedFuels.map(({ fuel, label }) => {
            const price = near.precios[fuel]!;
            const currentPrice = current.precios[fuel];
            const isCheaper = currentPrice !== null && price < currentPrice;
            return (
              <li key={fuel} className="flex items-center justify-between gap-2 flex-wrap">
                <span>
                  {label}: {formatPrice(price)}
                </span>
                {isCheaper && (
                  <span className="px-2 py-0.5 rounded border border-[var(--orange-border)] text-[var(--orange-primary)] font-sans font-bold">
                    más barata
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
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

  const brand = getStationBrand(station.rotulo);
  const munKey = `${station.provinciaSlug}:${station.municipioSlug}`;
  const munObj = data.municipiosMap.get(munKey);
  const provObj = data.provinciasMap.get(station.provinciaSlug);

  const statsMun = munObj ? calcularTodasLasStats(munObj.estaciones) : null;
  const statsProv = provObj ? calcularTodasLasStats(provObj.estaciones) : null;

  const summary = stationSummary(station, munObj?.estaciones ?? [station]);
  const nearby = nearbyStations(station, provObj?.estaciones ?? []);

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
    { label: `${station.rotulo} (${station.id})`, href: gasolineraStationPath(station) },
  ];

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Inicio', url: absoluteUrl('/') },
    { name: station.provincia, url: absoluteUrl(`/provincia/${station.provinciaSlug}`) },
    { name: station.municipio, url: absoluteUrl(`/provincia/${station.provinciaSlug}/${station.municipioSlug}`) },
    { name: `${station.rotulo} (${station.id})`, url: absoluteUrl(gasolineraStationPath(station)) },
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
    url: absoluteUrl(gasolineraStationPath(station)),
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

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={breadcrumbs} />

        {/* Ficha Principal de la Estación */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {brand ? (
                  <div className="inline-flex items-center gap-2 bg-white border border-[var(--border-color)] px-3 py-1.5 rounded-md shadow-xs">
                    <Image
                      src={assetPath(brand.logo)}
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

              <h1 className="text-xl md:text-3xl font-extrabold text-[var(--text-main)] break-words">
                Gasolinera {station.rotulo} en {station.municipio}
              </h1>

              <p className="text-sm text-[var(--text-main)]">{summary}</p>

              <div className="space-y-1.5 text-xs text-[var(--text-muted)] break-words">
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

            <div className="flex flex-col gap-3 md:min-w-[200px]">
              <a
                href={gmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] font-extrabold text-sm hover:bg-[var(--on-accent-hover)] transition-all shadow-md shadow-[var(--orange-glow)]"
              >
                <Navigation className="w-4 h-4" />
                <span>Cómo llegar (GPS)</span>
              </a>
              <InternalLink
                href={`/provincia/${station.provinciaSlug}/${station.municipioSlug}`}
                className="flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-xs font-bold text-[var(--text-main)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ver todo {station.municipio}</span>
              </InternalLink>
            </div>
          </div>

          {/* Comparativa de Ahorro para un Depósito de 50L */}
          {statsMun && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-[var(--border-subtle)] text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium block">
                  Gasolina 95 frente a la media municipal ({formatPrice(statsMun.gasolina95.avg)})
                </span>
                <span className="font-mono text-lg font-bold text-[var(--text-main)] mt-1 block">
                  {station.precios.gasolina95 && statsMun.gasolina95.avg
                    ? station.precios.gasolina95 <= statsMun.gasolina95.avg
                      ? `Ahorras ${formatEuros((statsMun.gasolina95.avg - station.precios.gasolina95) * TANK_LITERS)} por depósito de ${TANK_LITERS}L`
                      : `Cuesta +${formatEuros((station.precios.gasolina95 - statsMun.gasolina95.avg) * TANK_LITERS)} por depósito frente a la media`
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
                      ? `Ahorras ${formatEuros((statsMun.diesel.avg - station.precios.diesel) * TANK_LITERS)} por depósito de ${TANK_LITERS}L`
                      : `Cuesta +${formatEuros((station.precios.diesel - statsMun.diesel.avg) * TANK_LITERS)} por depósito frente a la media`
                    : 'Sin datos comparativos'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Lista Completa de Precios Registrados Hoy */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
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
                    <span className="font-mono text-xl md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1 block">
                      {formatPrice(price)}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-[var(--text-dim)] font-mono">
                    {TANK_LITERS}L = {formatEuros(price * TANK_LITERS)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {nearby.length > 0 && (
          <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
            <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[var(--orange-primary)]" />
              <span>Gasolineras cercanas</span>
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nearby.map(({ station: near, km }) => (
                <NearbyStationItem key={near.id} current={station} near={near} km={km} />
              ))}
            </ul>
            <InternalLink
              href={`/provincia/${station.provinciaSlug}/${station.municipioSlug}`}
              className="inline-flex items-center min-h-11 text-sm font-bold text-[var(--orange-primary)] hover:underline"
            >
              Todas las gasolineras de {station.municipio}
            </InternalLink>
          </section>
        )}

        <AdSlot />

        {/* Histórico semanal de precios de esta estación */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[var(--orange-primary)]" />
            <span>Evolución del precio en esta gasolinera</span>
          </h2>
          <StationHistory
            stationId={station.id}
            idProvincia={station.idProvincia}
            provinciaSlug={station.provinciaSlug}
            provinciaName={station.provincia}
            stationName={station.rotulo}
          />
        </div>

        {/* Mapa con la Ubicación Exacta de la Estación */}
        <div className="space-y-3">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
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

        <RedLinks pageKey={municipalityRedKey(station.provinciaSlug, station.municipioSlug)} />

        <AdSlot />
      </div>
    </>
  );
}
