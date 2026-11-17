# ARCHITECTURE — Mapa completo con agrupación por zoom y versión móvil

Este documento describe el cambio que añade **todas** las gasolineras al mapa del buscador de la home, agrupadas según el nivel de zoom, y adapta la web a pantallas de móvil. Es el contrato que reciben quienes implementan cada módulo: debe bastar sin más contexto.

## 1. Objetivo y alcance

### Qué hace

- El mapa del buscador de la home muestra **todas** las gasolineras que cumplen los filtros activos (carburante, provincia, marca, búsqueda, radio GPS). Hoy se cortan a 300 (`filteredStations.slice(0, 300)` en `InteractiveGasFinder.tsx`).
- Con zoom lejano (vista de España) las gasolineras se agrupan en burbujas con el número de estaciones y el precio mínimo del grupo. Al acercarse, las burbujas se dividen y aparecen los marcadores individuales con su precio, solo en la zona visible.
- La home deja de incrustar las ~11.500 estaciones en el HTML (hoy 7,4 MB). El buscador las descarga en formato ligero desde un endpoint JSON nuevo, `GET /api/estaciones`, cacheado 30 minutos.
- Toda la web se ve y se usa bien en móvil (anchos de 360 px en adelante): sin scroll horizontal, controles táctiles de al menos 40 px de alto, filas de botones desplazables en horizontal, mapa alto y usable con el dedo, campos de texto de 16 px en móvil para que iOS no haga zoom al enfocarlos.

### Qué no hace

- No añade dependencias nuevas. La agrupación es un algoritmo propio de rejilla en píxeles (no `leaflet.markercluster`).
- No cambia la descarga ni la validación de datos de MITECO (`src/lib/miteco.ts`).
- No cambia URLs, metadatos SEO, JSON-LD ni el sitemap.
- No añade funcionalidades nuevas al mapa (ni "mi ubicación" en el mapa, ni rutas).

## 2. Módulos

Las rutas son relativas a la raíz del proyecto. Los módulos de `src/lib` que se prueban con `node --test` **no pueden usar el alias `@/`** en importaciones de valores (Node no lo resuelve): usan rutas relativas, y para tipos `import type`, que se elimina al ejecutar.

### Módulo 1 — `src/lib/stationClustering.ts` (agrupación pura)

**Responsabilidad:** agrupar puntos geográficos en celdas de una rejilla en píxeles de pantalla, sin depender de Leaflet ni del DOM.

**Dependencias:** ninguna.

**Interfaz pública:**

```ts
/** Tamaño en píxeles de cada celda de la rejilla de agrupación. */
export const CLUSTER_CELL_SIZE_PX = 64;
/** Zoom máximo al que se agrupa. Con zoom mayor, todas las estaciones se muestran sueltas. */
export const CLUSTERING_MAX_ZOOM = 14;
/** Margen extra (fracción del tamaño visible) para no recortar marcadores en los bordes al desplazar. */
export const VIEWPORT_PADDING_RATIO = 0.25;

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
export function padBounds(bounds: LatLonBounds, ratio: number): LatLonBounds;

/** Devuelve los puntos dentro del rectángulo (bordes incluidos), conservando el orden de entrada. */
export function filterPointsInBounds<T extends GeoPoint>(points: readonly T[], bounds: LatLonBounds): T[];

/** true si a ese zoom hay que agrupar (zoom <= CLUSTERING_MAX_ZOOM). */
export function shouldCluster(zoom: number): boolean;

/**
 * Agrupa los puntos por celda: celda = (Math.floor(x / cellSizePx), Math.floor(y / cellSizePx)).
 * Devuelve un grupo por celda ocupada (los de un solo miembro también), en el orden en que
 * aparece por primera vez cada celda. Lanza RangeError si cellSizePx <= 0.
 */
export function clusterPoints<T extends GeoPoint>(
  points: readonly T[],
  project: Projector,
  cellSizePx: number
): PointCluster<T>[];

/** Mínimo de los valores no nulos; null si no hay ninguno. */
export function minNonNull(values: ReadonlyArray<number | null>): number | null;
```

**Criterio de aceptación** (`tests/stationClustering.test.ts`):

- `padBounds` amplía correctamente y lanza `RangeError` con ratio negativo.
- `filterPointsInBounds` incluye los bordes, excluye los de fuera y conserva el orden.
- `shouldCluster(14) === true`, `shouldCluster(15) === false`.
- `clusterPoints` con un proyector falso `(lat, lon) => ({ x: lon * 100, y: -lat * 100 })`: dos puntos en la misma celda forman un grupo con `count` 2, centroide y `bounds` correctos; puntos en celdas distintas forman grupos separados; lista vacía devuelve `[]`; `cellSizePx` 0 lanza `RangeError`.
- `minNonNull([null, 1.5, 1.2])` es 1.2; `minNonNull([null])` es null; `minNonNull([])` es null.

### Módulo 2 — `src/lib/stationPayload.ts` y `src/app/api/estaciones/route.ts` (datos ligeros)

**Responsabilidad:** reducir cada estación a los campos que usa el cliente y servirlas todas como JSON.

**Dependencias:** tipos de `src/lib/miteco.ts` (solo `import type ... from './miteco'`); la ruta usa `getMitecoData`.

**Interfaz pública de `src/lib/stationPayload.ts`:**

```ts
import type { Gasolinera, MitecoSnapshot } from './miteco';

/** Campos de una estación que necesitan el buscador, las tarjetas y el mapa. */
export type EstacionLigera = Pick<
  Gasolinera,
  | 'id' | 'slug' | 'rotulo' | 'direccion' | 'cp' | 'localidad' | 'municipio'
  | 'provincia' | 'provinciaSlug' | 'horario' | 'lat' | 'lon' | 'precios'
>;

export interface EstacionesPayload {
  fechaMiteco: string;
  estaciones: EstacionLigera[];
}

/** Copia explícita, campo a campo, de los campos de EstacionLigera (nunca un spread). */
export function toEstacionLigera(estacion: Gasolinera): EstacionLigera;

export function buildEstacionesPayload(
  snapshot: Pick<MitecoSnapshot, 'fechaMiteco' | 'estaciones'>
): EstacionesPayload;
```

**Ruta `GET /api/estaciones`** (`src/app/api/estaciones/route.ts`):

- `export const revalidate = 1800;`
- Respuesta 200: `EstacionesPayload` con cabecera `Cache-Control: public, s-maxage=1800, stale-while-revalidate=600`.
- Si `getMitecoData()` lanza: 503 con `{ error: 'No se pudieron obtener los precios de MITECO. Inténtalo de nuevo en unos minutos.' }` y el error se registra con `console.error`.

**Criterio de aceptación** (`tests/stationPayload.test.ts`):

- `toEstacionLigera` devuelve exactamente las 13 claves de `EstacionLigera` (sin `idMunicipio`, `municipioSlug`, `idProvincia`, `tipoVenta`, `remision`).
- `buildEstacionesPayload` conserva `fechaMiteco`, el número y el orden de estaciones.
- `npx tsc --noEmit` sin errores.

### Módulo 3 — `src/components/LeafletMap.tsx` y estilos del mapa (mapa agrupado y móvil)

**Responsabilidad:** pintar en Leaflet las estaciones visibles, agrupadas o sueltas según el zoom, con controles usables en móvil.

**Dependencias:** módulo 1; tipo `EstacionLigera` del módulo 2; `leaflet` (ya instalado).

**Interfaz pública** (props; cambia solo el tipo de `stations`):

```ts
interface LeafletMapProps {
  stations: EstacionLigera[];          // antes Gasolinera[]; Gasolinera es compatible
  selectedFuel?: FuelType;             // por defecto 'gasolina95'
  initialCenter?: [number, number];
  initialZoom?: number;
  highlightStationId?: string;
}
```

`ClientMapWrapper.tsx` cambia su tipo de props de la misma forma.

**Comportamiento:**

1. **Redibujado.** Una función `renderVisibleMarkers()` se ejecuta en `moveend` y `zoomend` del mapa (con un solo listener `moveend` basta, Leaflet lo emite tras el zoom) y cuando cambian `stations` o `selectedFuel`. Hace:
   - límites visibles `map.getBounds()` → `padBounds(…, VIEWPORT_PADDING_RATIO)` → `filterPointsInBounds`;
   - si `shouldCluster(map.getZoom())`: `clusterPoints(visibles, (lat, lon) => map.project([lat, lon], zoom), CLUSTER_CELL_SIZE_PX)`; un grupo de 1 miembro se pinta como marcador individual;
   - si no: todos los visibles como marcadores individuales;
   - la estación `highlightStationId` nunca se agrupa: siempre marcador individual con popup abierto.
   - limpia y repinta la capa de marcadores (`layerGroup.clearLayers()`).
2. **Precio** de una estación: `precios[selectedFuel]`; si es null, se usa `gasolina95` y luego `diesel` (comportamiento actual).
3. **Burbuja de grupo:** `L.divIcon` circular con el número de estaciones (formato `toLocaleString('es-ES')`) y debajo el precio corto "1,234€" con coma decimal, sin la palabra "desde" (mínimo de precios del grupo con `minNonNull`; se omite si es null y se oculta en la burbuja pequeña por falta de espacio). Tres tamaños por número de miembros: < 10, < 100, ≥ 100 (constantes con nombre). Al tocarla: `map.fitBounds(bounds del grupo, { padding: [48, 48] })`; si los miembros tienen todos la misma posición, `map.setView(centro, CLUSTERING_MAX_ZOOM + 1)`.
4. **Marcador individual:** el pin de precio actual (`.custom-station-pin`). El popup se crea **al abrirse** (`bindPopup(() => html)`), no para todas las estaciones por adelantado. Todo texto de MITECO que entra en HTML (rótulo, dirección, municipio) pasa por una función local `escapeHtml`. Los enlaces "Ver Ficha" y "Ruta GPS" del popup miden al menos 40 px de alto.
5. **Encuadre inicial.** Cuando cambia `stations` y no hay `highlightStationId`: si hay estaciones peninsulares/baleares (lat ≥ 34) y canarias (lat < 34), se encuadran solo las primeras (Canarias tiene su botón); `fitBounds` con `maxZoom: 15`. Con una sola estación: `setView(..., 15)`. Con cero: no se mueve. El encuadre **no** se repite en `moveend` (evitar bucles).
6. **Barra superior en móvil:** contador "N gasolineras" (total de `stations`); botones Península / Canarias; selector de capa. En pantallas < 640 px el selector de capa es un `<select>` nativo (Oscuro, CARTO, OSM, Satélite) y todo cabe en una o dos filas sin desbordar; en ≥ 640 px se mantienen los botones actuales. Todos los controles miden al menos 36 px de alto en móvil.
7. **Altura:** `h-[70vh] min-h-[420px] max-h-[760px] md:h-[600px]`. El contenedor del mapa usa `touch-action` por defecto de Leaflet (no bloquear el gesto de pellizco).
8. **Estilos** en `src/app/globals.css`: utilidad `.scrollbar-none` (oculta la barra de desplazamiento horizontal; la usa el módulo 4), clases `.station-cluster`, `.station-cluster--small|--medium|--large` (círculo naranja translúcido con borde naranja, texto legible en mapas claros y oscuros), popup con `max-width` 280 px en móvil.

**Criterio de aceptación:** `npx tsc --noEmit` sin errores; `npm test` pasa; revisión en pantalla (escritorio y 375×812): en vista de España se ven burbujas, no pines sueltos; al acercar a una ciudad aparecen pines de precio; al tocar una burbuja se acerca a su zona; sin scroll horizontal.

### Módulo 4 — Buscador de la home (`src/components/InteractiveGasFinder.tsx`, `src/app/page.tsx`, `src/components/StationCard.tsx`)

**Responsabilidad:** descargar las estaciones ligeras, filtrarlas y mostrarlas en lista o mapa, con una interfaz cómoda en móvil.

**Dependencias:** módulo 2 (tipo y endpoint); `LeafletMap` (módulo 3) por su interfaz de props.

**Interfaz pública:**

```ts
interface InteractiveGasFinderProps {
  provinces: Array<{ slug: string; name: string }>;
  statsNacionales: StatsPorCombustible;   // se mantiene aunque hoy no se use
}
// Se elimina la prop initialStations.

interface StationCardProps {
  station: EstacionLigera;   // antes Gasolinera
  selectedFuel: FuelType;
  isCheapest?: boolean;
}
```

**Comportamiento:**

1. Al montar, `fetch('/api/estaciones')` con `AbortController` (se aborta al desmontar). Estados: `cargando` (esqueleto con el mismo alto aproximado que la lista, texto "Cargando gasolineras…"), `error` (mensaje claro y botón "Reintentar"), `listo`.
2. El filtrado y la ordenación no cambian de lógica. La distancia se tipa explícitamente (`EstacionLigera & { distance?: number }`) en lugar de `any`.
3. La vista mapa recibe **todas** las estaciones filtradas (se elimina `.slice(0, 300)`).
4. `src/app/page.tsx` deja de pasar `initialStations`. El resto de la página no cambia salvo ajustes de móvil del bloque principal (paddings `p-4 md:p-8`, cifras que no desborden).
5. **Móvil (< 640 px):**
   - Fila de carburantes y fila de marcas: una sola línea desplazable en horizontal (`overflow-x-auto`, `whitespace-nowrap`, `shrink-0` en los botones), sin barra de scroll visible fea; botones de al menos 40 px de alto.
   - Buscador, provincia y orden apilados a ancho completo; `input` y `select` con `text-base` en móvil y `md:text-xs` en escritorio (evita el zoom automático de iOS).
   - El conmutador Lista/Mapa ocupa todo el ancho en móvil, con dos mitades iguales.
   - Botones de radio GPS de al menos 36 px de alto.
6. `StationCard` solo cambia el tipo de la prop y lo necesario para que no desborde en 360 px.

**Criterio de aceptación:** `npx tsc --noEmit` sin errores; `npm test` pasa; en pantalla la home carga la lista tras la descarga, el mapa muestra todas las filtradas, el error muestra "Reintentar".

### Módulo 5 — Pulido móvil del resto de la web

**Responsabilidad:** que cabecera, pie y páginas de provincia, municipio y ficha se vean bien en móvil.

**Ficheros:** `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/Breadcrumbs.tsx`, `src/app/provincia/[provincia]/page.tsx`, `src/app/provincia/[provincia]/[municipio]/page.tsx`, `src/app/gasolinera/[slug]/page.tsx`, `src/app/not-found.tsx`, `src/app/layout.tsx` y `src/app/globals.css` (solo reglas base, sin tocar las del mapa).

**Dependencias:** ninguna de código; se ejecuta después del módulo 3 porque comparte `globals.css`.

**Comportamiento:**

- Cabecera en una fila en 360 px: logo y título reducidos en móvil (`text-base sm:text-xl`), la fecha de actualización abreviada (solo hora o fecha corta) en móvil, botón de tema de 40 px.
- Ningún bloque provoca scroll horizontal: textos largos con `break-words`/`min-w-0`, rejillas que pasan a 1 o 2 columnas, tablas dentro de `overflow-x-auto`.
- Paddings de tarjetas grandes `p-4 md:p-6/8`; títulos `text-xl md:text-3xl` o similar.
- Enlaces y botones táctiles de al menos 40 px de alto.
- En `globals.css` (capa base): `html { -webkit-text-size-adjust: 100%; }`. No se usa `overflow-x: hidden` en `body` para tapar desbordamientos: se corrigen sus causas.
- `layout.tsx`: exporta `viewport` de Next (`width: 'device-width', initialScale: 1, themeColor` naranja/negro) si no existe.

**Criterio de aceptación:** `npx tsc --noEmit` sin errores; en pantalla a 375×812, ninguna página tiene scroll horizontal (`document.documentElement.scrollWidth <= innerWidth`).

## 3. Orden de implementación

1. Módulos 1 y 2 (sin dependencias, un solo encargo).
2. Módulos 3 y 4 en paralelo (ficheros disjuntos; el 3 es el único que toca `globals.css` en esta ola, así que la utilidad `.scrollbar-none` la añade el 3).
3. Módulo 5.
4. Integración: verificación en pantalla en escritorio y móvil, actualización de `README.md`.

## 4. Pruebas

- `npm test` ejecuta `node --experimental-strip-types --no-warnings --test` sobre `tests/*.test.js` y `tests/*.test.ts`. Requiere Node ≥ 22.6.
- Pruebas sin red, independientes entre sí.
- La comprobación de tipos del proyecto entero es `npx tsc --noEmit`.

## 5. Diseño de interfaz

- **Paleta:** la existente (negro y naranja `--orange-primary`, modo claro/oscuro con variables CSS).
- **Mapa, zoom lejano:** burbujas naranjas translúcidas con borde naranja sólido; número en negrita; línea pequeña con el precio mínimo, p. ej. "1,234€" (oculta en la pequeña). Pequeña 40 px, mediana 52 px, grande 64 px.
- **Mapa, zoom cercano:** pines de precio actuales.
- **Móvil:** una columna; filtros desplazables en horizontal; mapa al 70 % del alto de la pantalla; conmutador Lista/Mapa a ancho completo.
- **Estados del buscador:** cargando (esqueleto), error (mensaje + Reintentar), vacío (mensaje actual + Restablecer filtros), listo.
