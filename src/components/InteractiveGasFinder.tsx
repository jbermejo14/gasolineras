'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Gasolinera, FuelType, FUEL_LABELS, StatsPorCombustible } from '@/lib/miteco';
import { BRAND_CONFIG } from '@/lib/brands';
import { StationCard } from '@/components/StationCard';
import { Search, MapPin, SlidersHorizontal, List, Map as MapIcon, X } from 'lucide-react';

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
  initialStations: Gasolinera[];
  provinces: Array<{ slug: string; name: string }>;
  statsNacionales: StatsPorCombustible;
}

export function InteractiveGasFinder({ initialStations, provinces, statsNacionales }: InteractiveGasFinderProps) {
  const [fuel, setFuel] = useState<FuelType>('gasolina95');
  const [selectedProvince, setSelectedProvince] = useState<string>('TODAS');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'distance_asc' | 'name_asc'>('price_asc');
  const [view, setView] = useState<'list' | 'map'>('list');

  // Geolocalización
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState<number>(15);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);

  // Paginación
  const [visibleCount, setVisibleCount] = useState<number>(36);

  // Activar geolocalización
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
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Cálculo de distancia en km
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Filtrado reactivo en cliente sobre el conjunto inicial
  const filteredStations = useMemo(() => {
    let list = initialStations.filter((s) => s.precios[fuel] !== null && (s.precios[fuel] as number) > 0);

    if (selectedProvince !== 'TODAS') {
      list = list.filter((s) => s.provinciaSlug === selectedProvince);
    }

    if (selectedBrand) {
      const bObj = BRAND_CONFIG[selectedBrand];
      if (bObj) {
        list = list.filter((s) => bObj.keywords.some((k) => s.rotulo.toLowerCase().includes(k)));
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.rotulo.toLowerCase().includes(q) ||
          s.direccion.toLowerCase().includes(q) ||
          s.municipio.toLowerCase().includes(q) ||
          s.localidad.toLowerCase().includes(q) ||
          s.cp.includes(q)
      );
    }

    if (userCoords) {
      list = list
        .map((s) => {
          const d = getDistance(userCoords.lat, userCoords.lon, s.lat, s.lon);
          return { ...s, distance: d };
        })
        .filter((s: any) => s.distance <= radius);
    }

    // Ordenación
    list.sort((a: any, b: any) => {
      if (sortBy === 'price_asc') {
        return (a.precios[fuel] ?? 999) - (b.precios[fuel] ?? 999);
      }
      if (sortBy === 'price_desc') {
        return (b.precios[fuel] ?? -1) - (a.precios[fuel] ?? -1);
      }
      if (sortBy === 'distance_asc' && userCoords) {
        return (a.distance ?? 9999) - (b.distance ?? 9999);
      }
      if (sortBy === 'name_asc') {
        return a.rotulo.localeCompare(b.rotulo, 'es');
      }
      return 0;
    });

    return list;
  }, [initialStations, fuel, selectedProvince, selectedBrand, search, userCoords, radius, sortBy]);

  // Estadísticas del filtro actual
  const currentStats = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    for (const s of filteredStations) {
      const p = s.precios[fuel];
      if (p !== null && p > 0) {
        if (p < min) min = p;
        if (p > max) max = p;
        sum += p;
        count++;
      }
    }

    return {
      total: filteredStations.length,
      min: count > 0 ? min : null,
      max: count > 0 ? max : null,
      avg: count > 0 ? Math.round((sum / count) * 1000) / 1000 : null,
    };
  }, [filteredStations, fuel]);

  const displayedStations = filteredStations.slice(0, visibleCount);

  return (
    <section className="space-y-6">
      {/* Selector de Carburante */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm">
        <span className="text-xs uppercase tracking-wider font-extrabold text-[var(--text-muted)] block mb-3">
          1. Selecciona tipo de carburante
        </span>
        <div className="flex flex-wrap gap-2">
          {(['gasolina95', 'diesel', 'gasolina98', 'dieselPremium', 'glp', 'gnc'] as FuelType[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFuel(f);
                setVisibleCount(36);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                fuel === f
                  ? 'bg-[var(--orange-primary)] text-black shadow-md shadow-[var(--orange-glow)]'
                  : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--orange-border)]'
              }`}
            >
              <span>{FUEL_LABELS[f]}</span>
            </button>
          ))}
        </div>

        {/* Marcas Destacadas con Logos */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--text-dim)] block mb-2">
            Marcas destacadas:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedBrand('')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                selectedBrand === ''
                  ? 'bg-[var(--orange-primary)] text-black'
                  : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Todas
            </button>
            {Object.entries(BRAND_CONFIG).map(([key, item]) => (
              <button
                key={key}
                onClick={() => setSelectedBrand(selectedBrand === key ? '' : key)}
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedBrand === key
                    ? 'bg-[var(--orange-primary)] text-black shadow-xs'
                    : 'bg-white border border-[var(--border-color)] text-neutral-900 hover:border-[var(--orange-border)]'
                }`}
              >
                <Image
                  src={item.logo}
                  alt={item.name}
                  width={36}
                  height={18}
                  className="h-4 w-auto object-contain"
                />
                <span className="text-[11px] font-bold">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Barra de Filtros: Búsqueda, Provincia, Orden, GPS y Vista */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Buscador */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-dim)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por municipio, calle, CP o marca..."
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-hidden focus:border-[var(--orange-primary)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selector de Provincia */}
          <div>
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setVisibleCount(36);
              }}
              className="w-full py-2 px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-hidden focus:border-[var(--orange-primary)] transition-colors"
            >
              <option value="TODAS">Toda España</option>
              {provinces.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenación */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2 px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-hidden focus:border-[var(--orange-primary)] transition-colors"
            >
              <option value="price_asc">Precio: Más baratas</option>
              <option value="price_desc">Precio: Más caras</option>
              {userCoords && <option value="distance_asc">Distancia: Más cercanas</option>}
              <option value="name_asc">Nombre: A - Z</option>
            </select>
          </div>
        </div>

        {/* Subfila: GPS y Alternador Lista/Mapa */}
        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleGeo}
              disabled={geoLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition-all ${
                userCoords
                  ? 'bg-[var(--orange-primary)] text-black border-[var(--orange-primary)]'
                  : 'bg-[var(--bg-input)] text-[var(--orange-primary)] border-[var(--orange-border)] hover:bg-[var(--orange-primary)] hover:text-black'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{userCoords ? '📍 Ubicación Activa' : geoLoading ? 'Localizando...' : 'Cerca de mí'}</span>
            </button>

            {userCoords && (
              <div className="flex items-center gap-1 bg-[var(--bg-input)] p-1 rounded-md border border-[var(--border-color)]">
                <span className="text-[11px] text-[var(--text-muted)] px-1">Radio:</span>
                {[5, 15, 30, 50].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      radius === r ? 'bg-[var(--orange-primary)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center bg-[var(--bg-input)] border border-[var(--border-color)] p-1 rounded-lg">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold transition-all ${
                view === 'list'
                  ? 'bg-[var(--orange-primary)] text-black shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold transition-all ${
                view === 'map'
                  ? 'bg-[var(--orange-primary)] text-black shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Mapa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cinta de Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 shadow-sm">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
            Estaciones
          </span>
          <span className="font-mono text-2xl font-extrabold text-[var(--text-main)] mt-1 block">
            {currentStats.total.toLocaleString('es-ES')}
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">con precios registrados</span>
        </div>

        <div className="rounded-xl border border-[var(--orange-primary)] bg-[var(--bg-card)] p-3.5 shadow-sm">
          <span className="text-[11px] font-bold text-[var(--orange-primary)] uppercase tracking-wider block">
            Precio Más Barato
          </span>
          <span className="font-mono text-2xl font-extrabold text-[var(--orange-primary)] mt-1 block">
            {currentStats.min ? currentStats.min.toFixed(3) : '--'}
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">€/l</span>
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">Mínimo actual</span>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 shadow-sm">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
            Precio Medio
          </span>
          <span className="font-mono text-2xl font-extrabold text-[var(--text-main)] mt-1 block">
            {currentStats.avg ? currentStats.avg.toFixed(3) : '--'}
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">€/l</span>
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">Promedio del filtro</span>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 shadow-sm">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
            Precio Más Alto
          </span>
          <span className="font-mono text-2xl font-extrabold text-[var(--text-main)] mt-1 block">
            {currentStats.max ? currentStats.max.toFixed(3) : '--'}
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">€/l</span>
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">Máximo registrado</span>
        </div>
      </div>

      {/* Contenido: Vista Mapa o Vista Lista */}
      {view === 'map' ? (
        <LeafletMap stations={filteredStations.slice(0, 300)} selectedFuel={fuel} />
      ) : (
        <div>
          {displayedStations.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-12 text-center space-y-3">
              <span className="text-4xl block">⛽</span>
              <h3 className="font-bold text-base text-[var(--text-main)]">
                No se encontraron gasolineras con los filtros actuales
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Prueba a restablecer el buscador, cambiar la provincia o ampliar el radio de búsqueda.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedProvince('TODAS');
                  setSelectedBrand('');
                  setUserCoords(null);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--orange-primary)] text-black text-xs font-bold hover:bg-[var(--orange-hover)] transition-colors"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedStations.map((s) => (
                  <StationCard
                    key={s.id}
                    station={s}
                    selectedFuel={fuel}
                    isCheapest={currentStats.min !== null && s.precios[fuel] === currentStats.min}
                  />
                ))}
              </div>

              {visibleCount < filteredStations.length && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 36)}
                    className="px-6 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--orange-border)] text-xs font-bold text-[var(--orange-primary)] hover:bg-[var(--orange-primary)] hover:text-black transition-all shadow-sm"
                  >
                    Cargar más gasolineras ({filteredStations.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
