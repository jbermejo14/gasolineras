'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FuelType, StatsPorCombustible } from '@/lib/miteco';
import { GasFinderFuelBrand } from '@/components/GasFinderFuelBrand';
import { GasFinderFilters, GasFinderView } from '@/components/GasFinderFilters';
import { GasFinderStatsStrip } from '@/components/GasFinderStats';
import { GasFinderEmpty, GasFinderError, GasFinderList, GasFinderLoading } from '@/components/GasFinderResults';
import { useGasFinderStations } from '@/components/GasFinderLoader';
import {
  GAS_FINDER_PAGE_SIZE,
  GasFinderSort,
  gasFinderComputeStats,
  gasFinderFilterStations,
  gasFinderSortStations,
} from '@/components/GasFinderLogic';

const GEOLOCATION_TIMEOUT_MS = 10000;
const DEFAULT_RADIUS_KM = 15;

const LeafletMap = dynamic(
  () => import('@/components/LeafletMap').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[450px] rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-xs text-[var(--text-muted)] animate-pulse">
        Cargando mapa interactivo...
      </div>
    ),
  }
);

interface InteractiveGasFinderProps {
  provinces: Array<{ slug: string; name: string }>;
  // Se mantiene en el contrato aunque hoy no se use.
  statsNacionales: StatsPorCombustible;
}

export function InteractiveGasFinder({ provinces }: InteractiveGasFinderProps) {
  const { state, retry } = useGasFinderStations();

  const [fuel, setFuel] = useState<FuelType>('gasolina95');
  const [selectedProvince, setSelectedProvince] = useState<string>('TODAS');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<GasFinderSort>('price_asc');
  const [view, setView] = useState<GasFinderView>('list');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS_KM);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(GAS_FINDER_PAGE_SIZE);

  const stations = state.status === 'ready' ? state.stations : null;

  // El filtrado usa la búsqueda diferida para no recalcular ni reencuadrar el mapa en cada pulsación.
  const deferredSearch = useDeferredValue(search);

  // Sin ordenar: es lo que recibe el mapa, así cambiar el orden no lo reencuadra.
  const filteredStations = useMemo(
    () =>
      stations
        ? gasFinderFilterStations(stations, {
            fuel,
            province: selectedProvince,
            brand: selectedBrand,
            search: deferredSearch,
            userCoords,
            radius,
          })
        : [],
    [stations, fuel, selectedProvince, selectedBrand, deferredSearch, userCoords, radius]
  );

  const sortedStations = useMemo(
    () => gasFinderSortStations(filteredStations, { fuel, sortBy, userCoords }),
    [filteredStations, fuel, sortBy, userCoords]
  );

  // Ajuste de estado durante el render: cualquier cambio de filtro u orden vuelve a la primera página.
  const [previousSorted, setPreviousSorted] = useState(sortedStations);
  if (previousSorted !== sortedStations) {
    setPreviousSorted(sortedStations);
    setVisibleCount(GAS_FINDER_PAGE_SIZE);
  }

  const currentStats = useMemo(() => gasFinderComputeStats(filteredStations, fuel), [filteredStations, fuel]);

  const handleToggleGeo = () => {
    if (userCoords) {
      setUserCoords(null);
      if (sortBy === 'distance_asc') setSortBy('price_asc');
      return;
    }
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setSortBy('distance_asc');
        setGeoLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err.message);
        alert('No se pudo acceder a tu ubicación. Comprueba los permisos de tu navegador.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS }
    );
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedProvince('TODAS');
    setSelectedBrand('');
    setUserCoords(null);
    if (sortBy === 'distance_asc') setSortBy('price_asc');
  };

  const renderContent = () => {
    if (state.status === 'loading') return <GasFinderLoading />;
    if (state.status === 'error') return <GasFinderError message={state.message} onRetry={retry} />;
    if (view === 'map') return <LeafletMap stations={filteredStations} selectedFuel={fuel} />;
    if (sortedStations.length === 0) return <GasFinderEmpty onReset={handleResetFilters} />;
    return (
      <GasFinderList
        stations={sortedStations.slice(0, visibleCount)}
        totalCount={sortedStations.length}
        fuel={fuel}
        cheapestPrice={currentStats.min}
        onLoadMore={() => setVisibleCount((prev) => prev + GAS_FINDER_PAGE_SIZE)}
      />
    );
  };

  return (
    <section className="space-y-6">
      <GasFinderFuelBrand
        fuel={fuel}
        brand={selectedBrand}
        onFuelChange={setFuel}
        onBrandChange={setSelectedBrand}
      />

      <GasFinderFilters
        search={search}
        province={selectedProvince}
        provinces={provinces}
        sortBy={sortBy}
        hasLocation={userCoords !== null}
        geoLoading={geoLoading}
        radius={radius}
        view={view}
        onSearchChange={setSearch}
        onProvinceChange={setSelectedProvince}
        onSortChange={setSortBy}
        onToggleGeo={handleToggleGeo}
        onRadiusChange={setRadius}
        onViewChange={setView}
      />

      <GasFinderStatsStrip stats={currentStats} />

      {renderContent()}
    </section>
  );
}
