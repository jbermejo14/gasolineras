'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Gasolinera } from '@/lib/miteco';
import { getStationBrand } from '@/lib/brands';
import { Navigation, Layers } from 'lucide-react';

interface LeafletMapProps {
  stations: Gasolinera[];
  selectedFuel?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  highlightStationId?: string;
}

type MapLayerType = 'dark' | 'carto' | 'osm' | 'sat';

export function LeafletMap({
  stations,
  selectedFuel = 'gasolina95',
  initialCenter = [40.2, -3.7],
  initialZoom = 6,
  highlightStationId,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayersRef = useRef<any[]>([]);
  const markersLayerRef = useRef<any>(null);

  const [mapTheme, setMapTheme] = useState<MapLayerType>('dark');
  const [mapReady, setMapReady] = useState(false);

  // Sincronizar tema con modo claro/oscuro
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.documentElement.classList.contains('light');
      setMapTheme(isLight ? 'carto' : 'dark');
    }
  }, []);

  const applyTileLayer = useCallback((map: any, L: any, layer: MapLayerType) => {
    tileLayersRef.current.forEach((l) => {
      try {
        map.removeLayer(l);
      } catch {}
    });
    tileLayersRef.current = [];

    if (layer === 'carto') {
      const c = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      });
      c.addTo(map);
      tileLayersRef.current.push(c);
    } else if (layer === 'dark') {
      const db = L.tileLayer(
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { attribution: '&copy; Esri, OpenStreetMap', maxZoom: 16 }
      );
      const dr = L.tileLayer(
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16 }
      );
      db.addTo(map);
      dr.addTo(map);
      tileLayersRef.current.push(db, dr);
    } else if (layer === 'osm') {
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
      });
      osm.addTo(map);
      tileLayersRef.current.push(osm);
    } else if (layer === 'sat') {
      const sat = L.tileLayer(
        'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '&copy; Esri, Maxar', maxZoom: 18 }
      );
      sat.addTo(map);
      tileLayersRef.current.push(sat);
    }
  }, []);

  // Inicializar Leaflet map dinámicamente
  useEffect(() => {
    let isMounted = true;
    if (typeof window === 'undefined' || !containerRef.current) return;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 5,
        maxZoom: 20,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);
      applyTileLayer(map, L, mapTheme);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Cambiar capa cuando cambia mapTheme
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      if (mapInstanceRef.current) {
        applyTileLayer(mapInstanceRef.current, L, mapTheme);
      }
    });
  }, [mapTheme, mapReady, applyTileLayer]);

  // Renderizar marcadores
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current) return;

    import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      const markersLayer = markersLayerRef.current;
      markersLayer.clearLayers();

      const bounds: [number, number][] = [];
      const fuelKey = selectedFuel as keyof Gasolinera['precios'];

      stations.forEach((s) => {
        if (!s.lat || !s.lon) return;

        const priceVal = s.precios[fuelKey] ?? s.precios.gasolina95 ?? s.precios.diesel;
        const brand = getStationBrand(s.rotulo);
        const isHighlight = s.id === highlightStationId;

        const customIcon = L.divIcon({
          className: 'custom-station-pin-wrapper',
          html: `<div class="custom-station-pin ${isHighlight ? 'ring-2 ring-white scale-110' : ''}">${
            priceVal ? priceVal.toFixed(3) + '€' : '⛽'
          }</div>`,
          iconSize: [60, 24],
          iconAnchor: [30, 12],
        });

        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;
        const fichaUrl = `/gasolinera/${s.id}-${s.slug}`;

        const popupHtml = `
          <div style="padding: 12px; min-width: 220px; font-family: inherit;">
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 2px;">${s.rotulo}</div>
            <div style="font-size: 12px; color: #888; margin-bottom: 6px;">${s.direccion}, ${s.municipio}</div>
            <div style="font-family: monospace; font-size: 16px; font-weight: 800; color: #ff6600; margin-bottom: 8px;">
              ${priceVal ? priceVal.toFixed(3) + ' €/l' : 'Consultar'}
            </div>
            <div style="display: flex; gap: 6px;">
              <a href="${fichaUrl}" style="flex: 1; text-align: center; background: #ff6600; color: #000; font-size: 11px; font-weight: 700; padding: 5px 8px; border-radius: 4px; text-decoration: none;">
                Ver Ficha
              </a>
              <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #222; color: #fff; font-size: 11px; font-weight: 600; padding: 5px 8px; border-radius: 4px; text-decoration: none;">
                Ruta GPS
              </a>
            </div>
          </div>
        `;

        const marker = L.marker([s.lat, s.lon], { icon: customIcon }).bindPopup(popupHtml);
        markersLayer.addLayer(marker);
        bounds.push([s.lat, s.lon]);

        if (isHighlight) {
          marker.openPopup();
        }
      });

      if (bounds.length > 1 && !highlightStationId) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      }
    });
  }, [stations, selectedFuel, mapReady, highlightStationId]);

  const focusPeninsula = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([40.2, -3.7], 6, { duration: 0.8 });
    }
  };

  const focusCanarias = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([28.3, -15.8], 8, { duration: 0.8 });
    }
  };

  return (
    <div className="relative flex flex-col w-full h-[450px] md:h-[550px] rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] shadow-md">
      {/* Barra de control superior - Estilo zbe-map */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[var(--bg-header)] border-b border-[var(--border-color)] text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded font-extrabold bg-[var(--orange-primary)] text-black text-[10px] tracking-wider uppercase">
            MAPA
          </span>
          <span className="font-semibold text-[var(--text-muted)]">
            {stations.length} gasolinera{stations.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={focusPeninsula}
            className="px-2.5 py-1 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            Península
          </button>
          <button
            type="button"
            onClick={focusCanarias}
            className="px-2.5 py-1 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            Canarias
          </button>

          <div className="flex items-center bg-[var(--bg-input)] rounded border border-[var(--border-color)] p-0.5">
            <button
              type="button"
              onClick={() => setMapTheme('dark')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                mapTheme === 'dark' ? 'bg-[var(--orange-primary)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Oscuro
            </button>
            <button
              type="button"
              onClick={() => setMapTheme('carto')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                mapTheme === 'carto' ? 'bg-[var(--orange-primary)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              CARTO
            </button>
            <button
              type="button"
              onClick={() => setMapTheme('osm')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                mapTheme === 'osm' ? 'bg-[var(--orange-primary)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              OSM
            </button>
            <button
              type="button"
              onClick={() => setMapTheme('sat')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                mapTheme === 'sat' ? 'bg-[var(--orange-primary)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Satélite
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full flex-1 min-h-[350px]" />
    </div>
  );
}
