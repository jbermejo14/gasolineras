/**
 * Agrupación de puntos geográficos en una rejilla de píxeles de pantalla.
 * Módulo puro: no depende de Leaflet ni del DOM.
 */

/** Tamaño en píxeles de cada celda de la rejilla de agrupación. */
export const CLUSTER_CELL_SIZE_PX = 80;
/** Distancia mínima en píxeles entre centroides de burbujas; más cerca se fusionan. */
export const CLUSTER_MIN_SEPARATION_PX = 56;
/** Zoom máximo al que se agrupa. Con zoom mayor, todas las estaciones se muestran sueltas. */
export const CLUSTERING_MAX_ZOOM = 14;
/** Margen extra (fracción del tamaño visible) para no recortar marcadores en los bordes al desplazar. */
export const VIEWPORT_PADDING_RATIO = 0.25;
/** Mínimo de gasolineras para mostrar una burbuja; los grupos más pequeños se muestran como gasolineras sueltas. */
export const CLUSTER_MIN_MEMBERS = 4;

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface LatLonBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

/** Convierte lat/lon a píxeles absolutos del mapa al zoom actual (en Leaflet: map.project). */
export type Projector = (lat: number, lon: number) => PixelPoint;

export interface PointCluster<T extends GeoPoint> {
  /** Clave estable de la celda, p. ej. "12:-7". */
  key: string;
  /** Centroide (media aritmética de lat y lon de los miembros). */
  lat: number;
  lon: number;
  count: number;
  members: T[];
  /** Rectángulo mínimo que contiene a todos los miembros. */
  bounds: LatLonBounds;
}

/** Amplía un rectángulo en `ratio` veces su alto/ancho por cada lado. Lanza RangeError si ratio < 0. */
export function padBounds(bounds: LatLonBounds, ratio: number): LatLonBounds {
  if (!(ratio >= 0)) {
    throw new RangeError(`El margen del rectángulo debe ser un número >= 0: ${ratio}`);
  }
  const latMargin = (bounds.north - bounds.south) * ratio;
  const lonMargin = (bounds.east - bounds.west) * ratio;
  return {
    south: bounds.south - latMargin,
    west: bounds.west - lonMargin,
    north: bounds.north + latMargin,
    east: bounds.east + lonMargin,
  };
}

/** Devuelve los puntos dentro del rectángulo (bordes incluidos), conservando el orden de entrada. */
export function filterPointsInBounds<T extends GeoPoint>(points: readonly T[], bounds: LatLonBounds): T[] {
  return points.filter(
    (point) =>
      point.lat >= bounds.south &&
      point.lat <= bounds.north &&
      point.lon >= bounds.west &&
      point.lon <= bounds.east
  );
}

/** true si a ese zoom hay que agrupar (zoom <= CLUSTERING_MAX_ZOOM). */
export function shouldCluster(zoom: number): boolean {
  return zoom <= CLUSTERING_MAX_ZOOM;
}

function clusteringBuildCluster<T extends GeoPoint>(key: string, members: T[]): PointCluster<T> {
  const first = members[0];
  const bounds: LatLonBounds = { south: first.lat, west: first.lon, north: first.lat, east: first.lon };
  let latSum = 0;
  let lonSum = 0;
  for (const member of members) {
    latSum += member.lat;
    lonSum += member.lon;
    bounds.south = Math.min(bounds.south, member.lat);
    bounds.north = Math.max(bounds.north, member.lat);
    bounds.west = Math.min(bounds.west, member.lon);
    bounds.east = Math.max(bounds.east, member.lon);
  }
  return {
    key,
    lat: latSum / members.length,
    lon: lonSum / members.length,
    count: members.length,
    members,
    bounds,
  };
}

/**
 * Agrupa los puntos por celda: celda = (Math.floor(x / cellSizePx), Math.floor(y / cellSizePx)).
 * Devuelve un grupo por celda ocupada (los de un solo miembro también), en el orden en que
 * aparece por primera vez cada celda. Lanza RangeError si cellSizePx <= 0.
 */
export function clusterPoints<T extends GeoPoint>(
  points: readonly T[],
  project: Projector,
  cellSizePx: number
): PointCluster<T>[] {
  if (!(cellSizePx > 0)) {
    throw new RangeError(`El tamaño de celda debe ser mayor que 0: ${cellSizePx}`);
  }
  const cells = new Map<string, T[]>();
  for (const point of points) {
    const pixel = project(point.lat, point.lon);
    const key = `${Math.floor(pixel.x / cellSizePx)}:${Math.floor(pixel.y / cellSizePx)}`;
    const members = cells.get(key);
    if (members) {
      members.push(point);
    } else {
      cells.set(key, [point]);
    }
  }
  return Array.from(cells, ([key, members]) => clusteringBuildCluster(key, members));
}

interface MergeAccepted<T extends GeoPoint> {
  cluster: PointCluster<T>;
  pixel: PixelPoint;
}

function mergeFindNearby<T extends GeoPoint>(
  accepted: readonly MergeAccepted<T>[],
  pixel: PixelPoint,
  minSeparationPx: number
): MergeAccepted<T> | undefined {
  return accepted.find((entry) => Math.hypot(entry.pixel.x - pixel.x, entry.pixel.y - pixel.y) < minSeparationPx);
}

/**
 * Fusiona grupos cuyos centroides proyectados quedan a menos de minSeparationPx.
 * Algoritmo voraz de una pasada: recorre los grupos de mayor a menor count (empate: orden de entrada);
 * cada grupo se fusiona con el primer grupo ya aceptado a menos de minSeparationPx de su centroide,
 * o se acepta como nuevo. Al fusionar se recalculan miembros, count, centroide (media de los miembros)
 * y bounds; se conserva la key del grupo aceptado. Devuelve los grupos aceptados en el orden en que
 * se aceptaron. No muta la entrada. Lanza RangeError si minSeparationPx < 0 o NaN.
 * Al ser de una sola pasada, el centroide movido por una fusión no se vuelve a comparar con los
 * grupos ya aceptados: puede quedar algún solape residual. Se acepta porque en los datos reales
 * medidos (zooms 5 a 15) no aparece y repetir pasadas encarece el repintado.
 */
export function mergeOverlappingClusters<T extends GeoPoint>(
  clusters: readonly PointCluster<T>[],
  project: Projector,
  minSeparationPx: number
): PointCluster<T>[] {
  if (!(minSeparationPx >= 0)) {
    throw new RangeError(`La separación mínima debe ser un número >= 0: ${minSeparationPx}`);
  }
  // Array.prototype.sort es estable: en empate se conserva el orden de entrada.
  const byCountDescending = [...clusters].sort((a, b) => b.count - a.count);
  const accepted: MergeAccepted<T>[] = [];
  for (const cluster of byCountDescending) {
    const pixel = project(cluster.lat, cluster.lon);
    const target = mergeFindNearby(accepted, pixel, minSeparationPx);
    if (!target) {
      accepted.push({ cluster, pixel });
      continue;
    }
    const members = [...target.cluster.members, ...cluster.members];
    target.cluster = clusteringBuildCluster(target.cluster.key, members);
    target.pixel = project(target.cluster.lat, target.cluster.lon);
  }
  return accepted.map((entry) => entry.cluster);
}

/**
 * Separa los grupos con menos de minMembers miembros: sus miembros pasan a `singles`
 * (en orden de grupo y de miembro) y el resto se devuelve en `clusters`, también en orden.
 * No muta la entrada. Lanza RangeError si minMembers no es un entero >= 1.
 */
export function splitSmallClusters<T extends GeoPoint>(
  clusters: readonly PointCluster<T>[],
  minMembers: number
): { clusters: PointCluster<T>[]; singles: T[] } {
  if (!Number.isInteger(minMembers) || minMembers < 1) {
    throw new RangeError(`El mínimo de miembros debe ser un entero >= 1: ${minMembers}`);
  }
  const kept: PointCluster<T>[] = [];
  const singles: T[] = [];
  for (const cluster of clusters) {
    if (cluster.count >= minMembers) {
      kept.push(cluster);
    } else {
      singles.push(...cluster.members);
    }
  }
  return { clusters: kept, singles };
}

/** Mínimo de los valores no nulos; null si no hay ninguno. */
export function minNonNull(values: ReadonlyArray<number | null>): number | null {
  let min: number | null = null;
  for (const value of values) {
    if (value !== null && (min === null || value < min)) {
      min = value;
    }
  }
  return min;
}
