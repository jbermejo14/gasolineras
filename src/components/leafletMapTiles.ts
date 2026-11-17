import type * as Leaflet from 'leaflet';

export type MapLayerType = 'dark' | 'osm' | 'sat';

export const MAP_LAYER_OPTIONS: ReadonlyArray<{ value: MapLayerType; label: string }> = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'osm', label: 'OSM' },
  { value: 'sat', label: 'Satélite' },
];

/** Zoom máximo del mapa; por encima del nativo de cada capa las teselas se escalan. */
export const MAP_MAX_ZOOM = 20;

/** Clases de tamaño del mapa; el placeholder de carga las reutiliza para no provocar saltos de layout. */
export const MAP_SIZE_CLASSES = 'h-[70vh] min-h-[420px] max-h-[760px] md:h-[600px]';

const DARK_MAX_NATIVE_ZOOM = 16;
const SATELLITE_MAX_NATIVE_ZOOM = 18;
const OSM_MAX_NATIVE_ZOOM = 19;

const ESRI_BASE = 'https://services.arcgisonline.com/arcgis/rest/services';

/** Crea las capas de teselas de un tipo de mapa (sin añadirlas al mapa). */
export function createTileLayers(L: typeof Leaflet, layer: MapLayerType): Leaflet.TileLayer[] {
  switch (layer) {
    case 'dark':
      return [
        L.tileLayer(`${ESRI_BASE}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
          attribution: '&copy; Esri, OpenStreetMap',
          maxZoom: MAP_MAX_ZOOM,
          maxNativeZoom: DARK_MAX_NATIVE_ZOOM,
        }),
        L.tileLayer(`${ESRI_BASE}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: MAP_MAX_ZOOM,
          maxNativeZoom: DARK_MAX_NATIVE_ZOOM,
        }),
      ];
    case 'osm':
      return [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          subdomains: ['a', 'b', 'c'],
          maxZoom: MAP_MAX_ZOOM,
          maxNativeZoom: OSM_MAX_NATIVE_ZOOM,
        }),
      ];
    case 'sat':
      return [
        L.tileLayer(`${ESRI_BASE}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
          attribution: '&copy; Esri, Maxar',
          maxZoom: MAP_MAX_ZOOM,
          maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM,
        }),
      ];
  }
}
