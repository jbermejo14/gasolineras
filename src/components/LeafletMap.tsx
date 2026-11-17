'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { FuelType } from '@/lib/miteco';
import type { EstacionLigera } from '@/lib/stationPayload';
import { LeafletMapToolbar } from './LeafletMapToolbar';
import { MAP_MAX_ZOOM, MAP_SIZE_CLASSES, createTileLayers, type MapLayerType } from './leafletMapTiles';
import { fitStations, syncVisibleMarkers } from './leafletMapLayers';

interface LeafletMapProps {
  stations: EstacionLigera[];
  selectedFuel?: FuelType;
  initialCenter?: [number, number];
  initialZoom?: number;
  highlightStationId?: string;
}

const MIN_ZOOM = 5;
const PENINSULA_VIEW = { center: [40.2, -3.7] as [number, number], zoom: 6 };
const CANARIAS_VIEW = { center: [28.3, -15.8] as [number, number], zoom: 8 };
const FLY_DURATION_SECONDS = 0.8;

const MAP_LOAD_ERROR_MESSAGE = 'No se pudo cargar el mapa. Recarga la página.';

export function LeafletMap({
  stations,
  selectedFuel = 'gasolina95',
  initialCenter = PENINSULA_VIEW.center,
  initialZoom = PENINSULA_VIEW.zoom,
  highlightStationId,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapInstanceRef = useRef<Leaflet.Map | null>(null);
  const tileLayersRef = useRef<Leaflet.TileLayer[]>([]);
  const markersLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const autoOpenedStationIdRef = useRef<string | null>(null);

  const [mapTheme, setMapTheme] = useState<MapLayerType>('dark');
  const [mapReady, setMapReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Sincronizar tema con modo claro/oscuro
  useEffect(() => {
    const root = document.documentElement;
    const isLight = root.getAttribute('data-theme') === 'light' || root.classList.contains('light');
    setMapTheme(isLight ? 'carto' : 'dark');
  }, []);

  // Inicializar el mapa (Leaflet se importa de forma dinámica por no ser compatible con SSR)
  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;
    if (!container) return;

    import('leaflet')
      .then((L) => {
        if (!isMounted) return;
        const map = L.map(container, {
          center: initialCenter,
          zoom: initialZoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          zoomControl: false,
        });
        L.control.zoom({ position: 'topright' }).addTo(map);
        markersLayerRef.current = L.layerGroup().addTo(map);
        leafletRef.current = L;
        mapInstanceRef.current = map;
        setMapReady(true);
      })
      .catch((error: unknown) => {
        console.error('No se pudo cargar Leaflet', error);
        if (isMounted) setLoadFailed(true);
      });

    return () => {
      isMounted = false;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      tileLayersRef.current = [];
      setMapReady(false);
    };
    // El mapa se crea una sola vez; centro y zoom iniciales no se reaplican.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capa de teselas según el tema elegido
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!mapReady || !L || !map) return;
    tileLayersRef.current.forEach((tileLayer) => map.removeLayer(tileLayer));
    tileLayersRef.current = createTileLayers(L, mapTheme);
    tileLayersRef.current.forEach((tileLayer) => tileLayer.addTo(map));
  }, [mapTheme, mapReady]);

  // Marcadores visibles: se repintan al mover el mapa y al cambiar estaciones o carburante
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!mapReady || !L || !map || !layer) return;

    const registry = new Map<string, Leaflet.Marker>();
    const renderVisibleMarkers = () =>
      syncVisibleMarkers({ L, map, layer, registry,
        stations,
        fuel: selectedFuel,
        highlightStationId,
        autoOpenedStationId: autoOpenedStationIdRef,
      });

    renderVisibleMarkers();
    map.on('moveend', renderVisibleMarkers);
    return () => {
      map.off('moveend', renderVisibleMarkers);
      layer.clearLayers();
    };
  }, [stations, selectedFuel, highlightStationId, mapReady]);

  // Encuadre solo al cambiar la lista de estaciones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map || highlightStationId) return;
    fitStations(map, stations);
    // El resalte solo decide si se encuadra; cambiarlo no debe reencuadrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, mapReady]);

  const flyToView = useCallback((view: { center: [number, number]; zoom: number }) => {
    mapInstanceRef.current?.flyTo(view.center, view.zoom, { duration: FLY_DURATION_SECONDS });
  }, []);

  return (
    <div className={`relative flex flex-col w-full ${MAP_SIZE_CLASSES} rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] shadow-md`}>
      <LeafletMapToolbar
        stationCount={stations.length}
        mapTheme={mapTheme}
        onThemeChange={setMapTheme}
        onFocusPeninsula={() => flyToView(PENINSULA_VIEW)}
        onFocusCanarias={() => flyToView(CANARIAS_VIEW)}
      />
      {loadFailed && (
        <p role="alert" className="p-4 text-sm text-[var(--text-muted)]">
          {MAP_LOAD_ERROR_MESSAGE}
        </p>
      )}
      <div ref={containerRef} className={`w-full flex-1 min-h-0${loadFailed ? ' hidden' : ''}`} />
    </div>
  );
}
