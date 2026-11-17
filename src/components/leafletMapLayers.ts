import type * as Leaflet from 'leaflet';
import type { FuelType } from '@/lib/miteco';
import type { EstacionLigera } from '@/lib/stationPayload';
import {
  CLUSTER_CELL_SIZE_PX,
  CLUSTER_MIN_SEPARATION_PX,
  CLUSTERING_MAX_ZOOM,
  VIEWPORT_PADDING_RATIO,
  clusterPoints,
  filterPointsInBounds,
  mergeOverlappingClusters,
  minNonNull,
  padBounds,
  shouldCluster,
  type PointCluster,
} from '@/lib/stationClustering';
import {
  buildClusterIconSpec,
  buildPinIconSpec,
  buildStationPopupHtml,
  resolveStationPrice,
} from './leafletMapHtml';

/** Latitud por debajo de la cual una estación se considera canaria. */
const CANARY_MAX_LATITUDE = 34;
const FIT_PADDING_PX = 40;
const FIT_MAX_ZOOM = 15;
const CLUSTER_FIT_PADDING_PX = 48;
const POPUP_MAX_WIDTH_PX = 280;

export interface MarkerSyncParams {
  L: typeof Leaflet;
  map: Leaflet.Map;
  layer: Leaflet.LayerGroup;
  /** Marcadores ya pintados por clave; permite no tocar los que siguen visibles (y su popup abierto). */
  registry: Map<string, Leaflet.Marker>;
  stations: readonly EstacionLigera[];
  fuel: FuelType;
  highlightStationId?: string;
  /** Id de la estación cuyo popup ya se abrió solo; evita reabrirlo al recrear el marcador. */
  autoOpenedStationId: { current: string | null };
}

type MarkerEntry = { key: string; create: () => Leaflet.Marker };

function hasCoordinates(station: EstacionLigera): boolean {
  return Boolean(station.lat) && Boolean(station.lon);
}

function createStationMarker(params: MarkerSyncParams, station: EstacionLigera): Leaflet.Marker {
  const { L, fuel, highlightStationId } = params;
  const price = resolveStationPrice(station, fuel);
  const isHighlight = station.id === highlightStationId;
  const pin = buildPinIconSpec(price, isHighlight);
  const icon = L.divIcon({
    className: 'custom-station-pin-wrapper',
    html: pin.html,
    iconSize: pin.iconSize,
    iconAnchor: [pin.iconSize[0] / 2, pin.iconSize[1] / 2],
  });
  const marker = L.marker([station.lat, station.lon], { icon, title: station.rotulo });
  // El popup se construye al abrirse para no generar HTML de miles de estaciones.
  marker.bindPopup(() => buildStationPopupHtml(station, price), { maxWidth: POPUP_MAX_WIDTH_PX });
  return marker;
}

function clusterHasSinglePosition(cluster: PointCluster<EstacionLigera>): boolean {
  const { south, north, west, east } = cluster.bounds;
  return south === north && west === east;
}

function zoomToCluster(map: Leaflet.Map, cluster: PointCluster<EstacionLigera>): void {
  if (clusterHasSinglePosition(cluster)) {
    map.setView([cluster.lat, cluster.lon], CLUSTERING_MAX_ZOOM + 1);
    return;
  }
  const { south, west, north, east } = cluster.bounds;
  map.fitBounds(
    [
      [south, west],
      [north, east],
    ],
    { padding: [CLUSTER_FIT_PADDING_PX, CLUSTER_FIT_PADDING_PX] }
  );
}

function createClusterMarker(
  params: MarkerSyncParams,
  cluster: PointCluster<EstacionLigera>,
  minPrice: number | null
): Leaflet.Marker {
  const { L, map } = params;
  const spec = buildClusterIconSpec(cluster.count, minPrice);
  const icon = L.divIcon({
    className: spec.className,
    html: spec.html,
    iconSize: [spec.sizePx, spec.sizePx],
    iconAnchor: [spec.sizePx / 2, spec.sizePx / 2],
  });
  const marker = L.marker([cluster.lat, cluster.lon], { icon, title: spec.title });
  marker.on('click', () => zoomToCluster(map, cluster));
  return marker;
}

function buildStationEntry(params: MarkerSyncParams, station: EstacionLigera): MarkerEntry {
  return { key: `s:${station.id}`, create: () => createStationMarker(params, station) };
}

function buildClusterEntries(params: MarkerSyncParams, visible: EstacionLigera[], zoom: number): MarkerEntry[] {
  const { map, fuel, highlightStationId } = params;
  const highlighted = visible.filter((station) => station.id === highlightStationId);
  const clusterable = visible.filter((station) => station.id !== highlightStationId);
  const project = (lat: number, lon: number) => map.project([lat, lon], zoom);
  const cells = clusterPoints(clusterable, project, CLUSTER_CELL_SIZE_PX);
  const clusters = mergeOverlappingClusters(cells, project, CLUSTER_MIN_SEPARATION_PX);

  const entries = clusters.map((cluster): MarkerEntry => {
    if (cluster.count === 1) return buildStationEntry(params, cluster.members[0]);
    const minPrice = minNonNull(cluster.members.map((member) => resolveStationPrice(member, fuel)));
    return {
      key: `c:${zoom}:${cluster.key}:${cluster.count}:${minPrice}`,
      create: () => createClusterMarker(params, cluster, minPrice),
    };
  });
  return entries.concat(highlighted.map((station) => buildStationEntry(params, station)));
}

function buildEntries(params: MarkerSyncParams): MarkerEntry[] {
  const { map, stations } = params;
  const zoom = map.getZoom();
  const visibleBounds = map.getBounds();
  const padded = padBounds(
    {
      south: visibleBounds.getSouth(),
      west: visibleBounds.getWest(),
      north: visibleBounds.getNorth(),
      east: visibleBounds.getEast(),
    },
    VIEWPORT_PADDING_RATIO
  );
  const visible = filterPointsInBounds(stations, padded).filter(hasCoordinates);
  if (shouldCluster(zoom)) return buildClusterEntries(params, visible, zoom);
  return visible.map((station) => buildStationEntry(params, station));
}

/**
 * Sincroniza la capa de marcadores con lo visible: quita los que ya no tocan y añade los nuevos,
 * sin recrear los que siguen (así un popup abierto no se cierra al mover el mapa).
 */
export function syncVisibleMarkers(params: MarkerSyncParams): void {
  const { layer, registry, highlightStationId, autoOpenedStationId } = params;
  const entries = buildEntries(params);
  const wantedKeys = new Set(entries.map((entry) => entry.key));

  registry.forEach((marker, key) => {
    if (wantedKeys.has(key)) return;
    layer.removeLayer(marker);
    registry.delete(key);
  });

  entries.forEach((entry) => {
    if (registry.has(entry.key)) return;
    const marker = entry.create();
    layer.addLayer(marker);
    registry.set(entry.key, marker);
    const isUnopenedHighlight =
      highlightStationId !== undefined &&
      entry.key === `s:${highlightStationId}` &&
      autoOpenedStationId.current !== highlightStationId;
    if (isUnopenedHighlight) {
      marker.openPopup();
      autoOpenedStationId.current = highlightStationId;
    }
  });
}

function toLatLngTuples(stations: readonly EstacionLigera[]): [number, number][] {
  return stations.map((station): [number, number] => [station.lat, station.lon]);
}

/**
 * Encuadra las estaciones al cambiar la lista (nunca en moveend). Si hay peninsulares y canarias,
 * solo se encuadran las primeras: Canarias tiene su propio botón.
 */
export function fitStations(map: Leaflet.Map, stations: readonly EstacionLigera[]): void {
  const located = stations.filter(hasCoordinates);
  const mainland = located.filter((station) => station.lat >= CANARY_MAX_LATITUDE);
  const target = mainland.length > 0 ? mainland : located;
  if (target.length === 0) return;
  const points = toLatLngTuples(target);
  if (points.length === 1) {
    map.setView(points[0], FIT_MAX_ZOOM);
    return;
  }
  map.fitBounds(points, { padding: [FIT_PADDING_PX, FIT_PADDING_PX], maxZoom: FIT_MAX_ZOOM });
}
