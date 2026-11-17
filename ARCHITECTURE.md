# ARCHITECTURE — Gasolineras España

- **Parte 1** — Mapa completo con agrupación por zoom y versión móvil (implementada).
- **Parte 2** — Histórico de precios desde 2016.
- **Parte 3** — Textos legales, consentimiento de cookies y marca Ododex.

# Parte 1 — Mapa completo con agrupación por zoom y versión móvil

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

/**
 * Fusiona grupos cuyos centroides proyectados quedan a menos de minSeparationPx.
 * Algoritmo voraz de una pasada: recorre los grupos de mayor a menor count (empate: orden de entrada);
 * cada grupo se fusiona con el primer grupo ya aceptado a menos de minSeparationPx de su centroide,
 * o se acepta como nuevo. Al fusionar se recalculan miembros, count, centroide (media de los miembros)
 * y bounds; se conserva la key del grupo aceptado. Devuelve los grupos aceptados en el orden en que
 * se aceptaron. No muta la entrada. Lanza RangeError si minSeparationPx < 0 o NaN.
 */
export function mergeOverlappingClusters<T extends GeoPoint>(
  clusters: readonly PointCluster<T>[],
  project: Projector,
  minSeparationPx: number
): PointCluster<T>[];

/**
 * Separa los grupos con menos de minMembers miembros: sus miembros pasan a `singles`
 * (en orden de grupo y de miembro) y el resto se devuelve en `clusters`, también en orden.
 * No muta la entrada. Lanza RangeError si minMembers no es un entero >= 1.
 */
export function splitSmallClusters<T extends GeoPoint>(
  clusters: readonly PointCluster<T>[],
  minMembers: number
): { clusters: PointCluster<T>[]; singles: T[] };

/** Mínimo de los valores no nulos; null si no hay ninguno. */
export function minNonNull(values: ReadonlyArray<number | null>): number | null;
```

**Criterio de aceptación** (`tests/stationClustering.test.ts`):

- `padBounds` amplía correctamente y lanza `RangeError` con ratio negativo.
- `filterPointsInBounds` incluye los bordes, excluye los de fuera y conserva el orden.
- `shouldCluster(14) === true`, `shouldCluster(15) === false`.
- `clusterPoints` con un proyector falso `(lat, lon) => ({ x: lon * 100, y: -lat * 100 })`: dos puntos en la misma celda forman un grupo con `count` 2, centroide y `bounds` correctos; puntos en celdas distintas forman grupos separados; lista vacía devuelve `[]`; `cellSizePx` 0 lanza `RangeError`.
- `mergeOverlappingClusters`: fusiona grupos cercanos (count suma, centroide y bounds recalculados, key del mayor); no fusiona los alejados; el orden por count decide quién absorbe; lista vacía devuelve `[]`; no muta la entrada; separación negativa o NaN lanza `RangeError`; separación 0 no fusiona.
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
   - si `shouldCluster(map.getZoom())`: `clusterPoints(visibles, (lat, lon) => map.project([lat, lon], zoom), CLUSTER_CELL_SIZE_PX)` y después `mergeOverlappingClusters(grupos, mismo proyector, CLUSTER_MIN_SEPARATION_PX)` para fusionar burbujas solapadas; un grupo de 1 miembro se pinta como marcador individual. Los grupos de menos de 4 gasolineras se muestran como pines sueltos;
   - si no: todos los visibles como marcadores individuales;
   - la estación `highlightStationId` nunca se agrupa: siempre marcador individual con popup abierto.
   - limpia y repinta la capa de marcadores (`layerGroup.clearLayers()`).
2. **Precio** de una estación: `precios[selectedFuel]`; si es null, se usa `gasolina95` y luego `diesel` (comportamiento actual).
3. **Burbuja de grupo:** `L.divIcon` circular con el número de estaciones (formato `toLocaleString('es-ES')`) y debajo el precio corto "1,234€" con coma decimal, sin la palabra "desde" (mínimo de precios del grupo con `minNonNull`; se omite si es null y se oculta en la burbuja pequeña por falta de espacio). Tres tamaños por número de miembros: < 10, < 100, ≥ 100 (constantes con nombre). Al tocarla: `map.fitBounds(bounds del grupo, { padding: [48, 48] })`; si los miembros tienen todos la misma posición, `map.setView(centro, CLUSTERING_MAX_ZOOM + 1)`.
4. **Marcador individual:** el pin de precio actual (`.custom-station-pin`). El popup se crea **al abrirse** (`bindPopup(() => html)`), no para todas las estaciones por adelantado. Todo texto de MITECO que entra en HTML (rótulo, dirección, municipio) pasa por una función local `escapeHtml`. Los enlaces "Ver Ficha" y "Ruta GPS" del popup miden al menos 40 px de alto.
5. **Encuadre inicial.** Cuando cambia `stations` y no hay `highlightStationId`: si hay estaciones peninsulares/baleares (lat ≥ 34) y canarias (lat < 34), se encuadran solo las primeras (Canarias tiene su botón); `fitBounds` con `maxZoom: 15`. Con una sola estación: `setView(..., 15)`. Con cero: no se mueve. El encuadre **no** se repite en `moveend` (evitar bucles).
6. **Barra superior en móvil:** contador "N gasolineras" (total de `stations`); botones Península / Canarias; selector de capa. En pantallas < 640 px el selector de capa es un `<select>` nativo (Oscuro, OSM, Satélite) y todo cabe en una o dos filas sin desbordar; en ≥ 640 px se mantienen los botones actuales. Todos los controles miden al menos 36 px de alto en móvil.
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
- **Mapa, zoom lejano:** burbujas naranjas translúcidas con borde naranja sólido; número en negrita; línea pequeña con el precio mínimo, p. ej. "1,234€" (oculta en la pequeña). Pequeña 34 px, mediana 46 px, grande 56 px.
- **Mapa, zoom cercano:** pines de precio actuales.
- **Móvil:** una columna; filtros desplazables en horizontal; mapa al 70 % del alto de la pantalla; conmutador Lista/Mapa a ancho completo.
- **Estados del buscador:** cargando (esqueleto), error (mensaje + Reintentar), vacío (mensaje actual + Restablecer filtros), listo.

---

# Parte 2 — Histórico de precios desde 2016

## H.1 Objetivo y alcance

### Qué hace

- Gráficas de evolución del precio de **Gasolina 95 E5, Gasóleo A (Diésel), Gasolina 98 E5 y Diésel Premium** desde el lunes 4 de enero de 2016 hasta el último lunes disponible, con **un punto por semana** (el precio vigente cada lunes).
- Ámbitos: **España**, **comunidad autónoma** (19), **provincia** (52), **marca** (las 14 de `BRAND_CONFIG`) y **gasolinera** (cada ficha).
- Páginas nuevas indexables, generadas de forma estática en el build, con SEO completo: `/historico`, `/historico/comunidad/[comunidad]`, `/historico/provincia/[provincia]`, `/historico/marca/[marca]`. El histórico de cada gasolinera va dentro de su ficha (`/gasolinera/[slug]`), sin URL nueva.
- Un comando, `npm run historico`, descarga de MITECO solo las semanas que faltan, recalcula los datos y, con `--subir`, sube a **Cloudflare R2** los ficheros por gasolinera.

### Qué no hace

- No calcula medias semanales reales: cada punto es la foto del lunes (`EstacionesTerrestresHist/{dd-mm-yyyy}`). Se dice así en cada página.
- No hay histórico por municipio ni de los carburantes minoritarios (GLP, GNC, GNL, Gasóleo B, AdBlue).
- No prepara el despliegue en Cloudflare (adaptador OpenNext); eso es un trabajo aparte. El diseño no lo bloquea: las páginas de histórico son estáticas y el histórico por gasolinera se lee desde el navegador.
- No crea el bucket R2 ni sus credenciales (lo hace el usuario; ver README).
- No toca `src/lib/miteco.ts` ni las páginas existentes salvo los enlaces y la sección de la ficha descritos aquí.

## H.2 Fuente de datos (MITECO)

- Histórico de un día: `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestresHist/{dd-mm-yyyy}`. Devuelve `{ Fecha, ListaEESSPrecio: [...] }` con los mismos campos que el endpoint actual: `IDEESS`, `Rótulo`, `IDProvincia`, `IDCCAA`, `Precio Gasolina 95 E5`, `Precio Gasoleo A`, `Precio Gasolina 98 E5`, `Precio Gasoleo Premium`, etc. Unos 11–12 MB por día. Verificado con 17-11-2016 y 17-11-2025.
- Listado de provincias (ya usado en `miteco.ts`, `MITECO_URL_PROVINCIAS`): `[{ IDPovincia, IDCCAA, Provincia, CCAA }]`. Ojo: la clave es `IDPovincia`, con esa errata.
- Precios: se validan con `parseAndValidatePrice` de `src/lib/miteco.ts` (rango 0,50–3,50 €/l) y se guardan como **enteros en milésimas de euro** (1,459 €/l → `1459`).

## H.3 Formatos de datos

Tipos en `src/lib/historicoFormat.ts` (módulo H1).

```ts
export const HISTORY_FUELS = ['gasolina95', 'diesel', 'gasolina98', 'dieselPremium'] as const;
export type HistoryFuel = (typeof HISTORY_FUELS)[number]; // subconjunto de FuelType de miteco.ts
export const HISTORY_START_DATE = '2016-01-04';            // primer lunes de 2016
export type PriceMilli = number;                           // milésimas de euro por litro
export type FuelSeries = (PriceMilli | null)[];             // un valor por semana; null = sin dato

/** Registro de una gasolinera en una semana (caché local del script). */
export interface WeekStationRecord {
  id: string;            // IDEESS
  idProvincia: string;   // "28"
  idCCAA: string;        // "13"
  rotulo: string;
  prices: Record<HistoryFuel, PriceMilli | null>;
}
export interface WeekSnapshot { date: string; stations: WeekStationRecord[] } // date ISO del lunes

export type AreaKind = 'espana' | 'comunidad' | 'provincia' | 'marca';
export interface AreaFuelSeries { avg: FuelSeries; min: FuelSeries; count: number[] }
export interface AreaHistory {
  kind: AreaKind;
  slug: string;          // 'espana' | slug de comunidad | provinciaSlug actual | clave de BRAND_CONFIG
  name: string;          // nombre para mostrar
  parentSlug?: string;   // solo provincia: slug de su comunidad
  series: Record<HistoryFuel, AreaFuelSeries>;
}
export interface AreaIndexEntry { kind: AreaKind; slug: string; name: string; parentSlug?: string }
export interface HistoryIndexFile { version: 1; generatedAt: string; weeks: string[]; areas: AreaIndexEntry[] }
export interface AreaHistoryFile { version: 1; weeks: string[]; area: AreaHistory }

/** Partición del histórico por gasolinera: una provincia y un año. Series en delta. */
export interface StationPartitionFile {
  version: 1;
  idProvincia: string;
  year: number;
  weeks: string[];                                               // lunes de ese año, en orden
  stations: Record<string, Partial<Record<HistoryFuel, (number | null)[]>>>; // id → carburante → serie delta; carburante omitido si todo null
}
```

### Ficheros y dónde viven

| Fichero | Contenido | Dónde |
|---|---|---|
| `data/historico/cache/{yyyy-mm-dd}.json.gz` | `WeekSnapshot` de un lunes (gzip) | Solo local, **ignorado por git**. Evita volver a descargar. |
| `data/historico/indice.json` | `HistoryIndexFile` (semanas y lista de áreas, unos KB) | **En git** |
| `data/historico/areas/{kind}/{slug}.json` | `AreaHistoryFile` (unos 30 KB cada uno, 86 ficheros) | **En git** |
| `public/historico-estaciones/{idProvincia}/{year}.json` | `StationPartitionFile` | Local, **ignorado por git** (sirve para desarrollo) |
| R2: `estaciones/{idProvincia}/{year}.json` | Lo mismo | Bucket R2 público, servido por su dominio |

El navegador lee el histórico por gasolinera de `${NEXT_PUBLIC_HISTORICO_BASE_URL}/{idProvincia}/{year}.json`. Por defecto `NEXT_PUBLIC_HISTORICO_BASE_URL=/historico-estaciones` (los ficheros locales de `public/`); en producción, la URL pública del bucket con el prefijo `estaciones` (p. ej. `https://datos.ejemplo.com/estaciones`).

### Codificación delta de las series de gasolinera

`encodeDeltaSeries(values)`: para cada posición `i`, si `values[i]` es `null` → `null`; si `i === 0` o `values[i-1]` es `null` → el valor absoluto; si no → `values[i] - values[i-1]`. `decodeDeltaSeries` es la inversa exacta. Los precios cambian poco de una semana a otra, así que la mayoría de valores son 0 o pequeños y el fichero comprime muy bien.

### Reglas de agregación

- Por semana, área y carburante: `avg = Math.round(media de precios válidos)`, `min = mínimo`, `count = número de gasolineras con precio`. Sin precios → `avg = null`, `min = null`, `count = 0`.
- Semanas cuya descarga falló (no hay caché): todas las áreas tienen `null`/`0` en esa posición; la próxima ejecución lo reintenta.
- Área de cada registro: `espana` siempre; comunidad por `idCCAA` (tabla de `src/lib/ccaa.ts`); provincia por `idProvincia` (nombre y slug del listado oficial: `slugify(Provincia)` de `miteco.ts`, igual que la web actual); marca con `getStationBrand(rotulo)` de `src/lib/brands.ts` (la clave de `BRAND_CONFIG` cuyo valor es el devuelto). Registros con IDs desconocidos solo cuentan para España (y marca).
- Partición por gasolinera `(idProvincia, year)`: incluye cada gasolinera con algún registro ese año en esa provincia; sus valores salen solo de esos registros, el resto `null`.

## H.4 Módulos

### H1 — `src/lib/historicoFormat.ts` y `src/lib/ccaa.ts` (formato y tablas; sin dependencias)

**historicoFormat.ts** — tipos y constantes de H.3, más funciones puras:

```ts
export function priceToMilli(price: number): PriceMilli;          // Math.round(price * 1000)
export function milliToPrice(value: PriceMilli): number;          // value / 1000
/** Lunes desde fromIso (debe ser lunes; si no, RangeError) hasta el último lunes <= toDate. Fechas ISO 'yyyy-mm-dd' en UTC. */
export function listMondays(fromIso: string, toDate: Date): string[];
export function isoToMitecoDate(iso: string): string;            // '2016-01-04' → '04-01-2016'
export function yearOfIso(iso: string): number;
export function encodeDeltaSeries(values: FuelSeries): (number | null)[];
export function decodeDeltaSeries(encoded: readonly (number | null)[]): FuelSeries;
/** Une las particiones de varios años de una gasolinera en una serie continua (años en orden ascendente; semanas concatenadas). */
export function mergeStationPartitions(
  files: readonly StationPartitionFile[],
  stationId: string
): { weeks: string[]; series: Record<HistoryFuel, FuelSeries> };
```

**ccaa.ts** — tabla fija con los códigos `IDCCAA` **de MITECO** (no del INE: en MITECO `07` es Castilla-La Mancha y `08` Castilla y León):

```ts
export interface Comunidad { id: string; name: string; slug: string }
export const COMUNIDADES: readonly Comunidad[]; // 19 entradas
export function findComunidadById(id: string): Comunidad | null;
export function findComunidadBySlug(slug: string): Comunidad | null;
```

| id | name | slug |
|---|---|---|
| 01 | Andalucía | andalucia |
| 02 | Aragón | aragon |
| 03 | Asturias | asturias |
| 04 | Islas Baleares | islas-baleares |
| 05 | Canarias | canarias |
| 06 | Cantabria | cantabria |
| 07 | Castilla-La Mancha | castilla-la-mancha |
| 08 | Castilla y León | castilla-y-leon |
| 09 | Cataluña | cataluna |
| 10 | Comunidad Valenciana | comunidad-valenciana |
| 11 | Extremadura | extremadura |
| 12 | Galicia | galicia |
| 13 | Comunidad de Madrid | comunidad-de-madrid |
| 14 | Región de Murcia | region-de-murcia |
| 15 | Navarra | navarra |
| 16 | País Vasco | pais-vasco |
| 17 | La Rioja | la-rioja |
| 18 | Ceuta | ceuta |
| 19 | Melilla | melilla |

**Aceptación** (`tests/historicoFormat.test.ts`, `tests/ccaa.test.ts`): `listMondays` (inicio, fin no lunes, cruce de año, RangeError); `isoToMitecoDate`; round-trip delta con nulls al principio, en medio y al final; `mergeStationPartitions` con años desordenados, gasolinera ausente en un año (nulls) y carburante omitido; tabla de 19 comunidades con ids y slugs únicos.

### H2 — `src/lib/historicoBuild.ts` (agregación pura; depende de H1, `miteco.ts`, `brands.ts`)

Solo imports relativos con extensión `.ts` (lo ejecuta el script con `node --experimental-strip-types`, sin alias `@/`).

```ts
/** Reduce la respuesta cruda de MITECO de un día a un WeekSnapshot. Descarta registros sin IDEESS. */
export function buildWeekSnapshot(raw: { ListaEESSPrecio?: unknown[] }, date: string): WeekSnapshot;
export interface ProvinceInfo { idProvincia: string; name: string; slug: string; comunidadSlug: string | null }
/** A partir del listado oficial de provincias (claves IDPovincia/IDCCAA/Provincia). */
export function buildProvinceTable(listing: readonly Record<string, unknown>[]): Map<string, ProvinceInfo>;
/** Acumulador de series por área: se le pasan las semanas una a una (memoria acotada). */
export class AreaHistoryAccumulator {
  constructor(weeks: readonly string[], provinces: ReadonlyMap<string, ProvinceInfo>);
  addWeek(snapshot: WeekSnapshot): void;   // RangeError si la fecha no está en weeks
  build(): { index: HistoryIndexFile; areas: AreaHistoryFile[] };  // áreas sin ningún dato se omiten
}
/** Particiones (provincia, año) de un año, a partir de los snapshots de ese año (los que falten quedan en null). */
export function buildStationPartitionsForYear(
  year: number, weeksOfYear: readonly string[], snapshots: readonly WeekSnapshot[]
): StationPartitionFile[];
```

Orden de `areas` en el índice: España, comunidades (orden de la tabla), provincias (por nombre), marcas (orden de `BRAND_CONFIG`). Nombre de provincia para mostrar: el del listado con solo la primera letra de cada palabra en mayúscula (`'ALICANTE'` → `'Alicante'`, `'ARABA/ÁLAVA'` → `'Araba/Álava'`).

**Aceptación** (`tests/historicoBuild.test.ts`, sin red, con datos mínimos inventados y `tests/fixtures/miteco-sample.json`): precios inválidos y vacíos → null; medias redondeadas, mínimos y recuentos; semana sin snapshot → null/0; marca por rótulo; provincia y comunidad desconocidas solo cuentan en España; particiones con gasolinera presente en parte del año; RangeError con fecha ajena.

### H3 — `scripts/historico.ts` (CLI; depende de H1, H2)

`npm run historico -- [--hasta=yyyy-mm-dd] [--subir] [--subir-todo]` (script en `package.json`: `node --experimental-strip-types --no-warnings scripts/historico.ts`).

1. `weeks = listMondays(HISTORY_START_DATE, hasta ?? hoy)`.
2. Descarga el listado de provincias (una vez) y, para cada semana sin caché, el histórico del día: timeout 120 s, 3 reintentos con espera 5/15/45 s, **2 descargas simultáneas**. Respuesta vacía o error tras reintentos → se registra y se sigue. Cada snapshot se guarda en `data/historico/cache/{date}.json.gz` (`node:zlib`). Progreso en consola: `[123/470] 2018-05-07 ok (11.402 gasolineras)`.
3. Construye agregados leyendo la caché semana a semana (`AreaHistoryAccumulator`, nunca todas en memoria) y escribe `data/historico/indice.json` y `data/historico/areas/{kind}/{slug}.json` (JSON sin sangría).
4. Construye las particiones año a año (solo los snapshots de un año en memoria) y escribe `public/historico-estaciones/{idProvincia}/{year}.json`.
5. Con `--subir`: sube a R2 las particiones de los años que tengan alguna semana descargada en esta ejecución; con `--subir-todo`, todas. Cliente S3 de R2 con la dependencia **`aws4fetch` 1.0.20** (versión fija, `devDependencies`): `PUT https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{R2_BUCKET}/estaciones/{idProvincia}/{year}.json`, `Content-Type: application/json`, `Cache-Control: public, max-age=86400`. Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`; si falta alguna, error que diga cuál y cómo configurarla, antes de descargar nada.
6. Resumen final: semanas descargadas, fallidas (con fechas), ficheros escritos y subidos.

Funciones puras exportadas y probadas (`tests/historicoScript.test.ts`): `parseHistoricoArgs(argv)` (errores claros con opciones desconocidas o fecha inválida) y `findMissingWeeks(weeks, cachedDates)`. La red y el disco no se prueban.

También: `.gitignore` añade `data/historico/cache/` y `public/historico-estaciones/`; `.env.example` documenta `NEXT_PUBLIC_HISTORICO_BASE_URL` y las cuatro `R2_*`.

### H4 — `src/lib/historicoStats.ts` y `src/lib/historico.ts` (lectura y resúmenes; depende de H1)

**historicoStats.ts** (puro):

```ts
export interface DatedValue { date: string; value: PriceMilli }
export interface SeriesSummary {
  latest: DatedValue | null;          // último valor no nulo
  yearAgo: DatedValue | null;         // valor no nulo más cercano a 52 semanas antes de latest (±2 semanas)
  changePct: number | null;           // (latest - yearAgo) / yearAgo * 100, 1 decimal
  max: DatedValue | null;             // máximo histórico (primera fecha en empate)
  min: DatedValue | null;
  yearlyAverages: { year: number; avg: PriceMilli; weeks: number }[]; // media de los avg no nulos de cada año
}
export function summarizeSeries(weeks: readonly string[], values: FuelSeries): SeriesSummary;
export function formatMilliEuro(value: PriceMilli): string;   // 1459 → '1,459 €/l'
export function formatIsoDateEs(iso: string): string;         // '2022-07-04' → '4 de julio de 2022'
/** Párrafo introductorio único por área, en español, con cifras de G95 y Diésel (actual, variación anual, máximo con fecha) y comparación con España si el área no es España. */
export function buildAreaIntro(area: AreaHistory, weeks: readonly string[], spain: AreaHistory | null): string;
```

**historico.ts** (solo servidor, usa `node:fs`): lee `data/historico/indice.json` y `data/historico/areas/...` con `fs.readFileSync(path.join(process.cwd(), ...))`, con caché en memoria.

```ts
export function getHistoryIndex(): HistoryIndexFile | null;              // null si no existe el fichero
export function getAreasByKind(kind: AreaKind): AreaIndexEntry[];
export function loadAreaHistory(kind: AreaKind, slug: string): AreaHistoryFile | null;
```

**Aceptación** (`tests/historicoStats.test.ts`): resúmenes con nulls, empates, serie vacía, yearAgo ausente; formatos; `buildAreaIntro` contiene las cifras esperadas y no menciona España cuando el área es España.

### H5 — Gráfica: `src/lib/priceChartGeometry.ts` y `src/components/PriceHistoryChart.tsx` (depende de H1 y de `formatIsoDateEs`/`formatMilliEuro` de H4)

**priceChartGeometry.ts** (puro):

```ts
export interface ChartInput {
  weeks: readonly string[];
  series: readonly { fuel: HistoryFuel; values: FuelSeries }[];
  width: number; height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}
export interface ChartGeometry {
  paths: { fuel: HistoryFuel; d: string }[];      // los null cortan la línea (nuevo "M")
  yTicks: { value: PriceMilli; y: number; label: string }[]; // 4–6 marcas "redondas" (pasos de 0,05/0,10/0,20 €)
  xTicks: { label: string; x: number }[];          // años (o meses si el rango < 18 meses)
  indexAtX(x: number): number;                     // índice de semana más cercano a una x de pantalla
  pointAt(index: number, fuel: HistoryFuel): { x: number; y: number } | null;
}
export function buildChartGeometry(input: ChartInput): ChartGeometry; // RangeError si width/height <= padding
```

**PriceHistoryChart.tsx** (`'use client'`; se renderiza también en el servidor, así el SVG va en el HTML):

- Props: `{ weeks: string[]; series: Partial<Record<HistoryFuel, FuelSeries>>; title: string; defaultFuels?: HistoryFuel[]; defaultRange?: 'year' | 'fiveYears' | 'all' }`.
- Botones de carburante (activar/desactivar, por defecto G95 y Diésel) y de rango (1 año, 5 años, Todo). Solo aparecen los carburantes con algún dato.
- SVG con `viewBox` fijo (800×320; 360×260 si el contenedor mide < 640 px, medido con `ResizeObserver`), `role="img"`, `<title>` = `title` y `<desc>` con el último precio de cada carburante visible.
- Tooltip al mover el ratón o el dedo: línea vertical, fecha (`formatIsoDateEs`) y precio de cada carburante. Accesible con teclado (flechas izquierda/derecha cuando el gráfico tiene foco).
- Colores: gasolina95 `#ff6600`, diesel `#3b82f6`, gasolina98 `#a855f7`, dieselPremium `#22c55e`; ejes y rejilla con `var(--border-color)` y `var(--text-muted)`.
- Estado vacío: "Todavía no hay datos históricos para mostrar."

**Aceptación** (`tests/priceChartGeometry.test.ts`): escalas en los bordes, cortes por null, ticks redondos, `indexAtX` en bordes y centro, RangeError. El componente se verifica en pantalla.

### H6 — Páginas de histórico y SEO (depende de H4, H5 y de datos reales)

Ficheros: `src/app/historico/page.tsx`, `src/app/historico/comunidad/[comunidad]/page.tsx`, `src/app/historico/provincia/[provincia]/page.tsx`, `src/app/historico/marca/[marca]/page.tsx`, plantilla compartida `src/components/HistoricoArea.tsx` (servidor) y `getDatasetSchema` nuevo en `src/lib/seo.ts`.

- Todas: `export const dynamic = 'force-static'`, `export const dynamicParams = false`, `generateStaticParams` desde `getAreasByKind`. Slug inexistente → 404.
- **Metadatos** (`generateMetadata`): título y descripción únicos con el rango de años y la cifra actual, canonical absoluto, Open Graph.
  - España: "Precio histórico de la gasolina y el diésel en España (2016-2026)".
  - Comunidad: "Evolución del precio de la gasolina y el diésel en {Comunidad} desde 2016".
  - Provincia: "Precio histórico de la gasolina y el diésel en {Provincia} desde 2016".
  - Marca: "Evolución del precio de la gasolina en {Marca} desde 2016".
  - Descripción: "Gasolina 95 a {x} €/l y diésel a {y} €/l ({±z} % en un año). Máximo histórico {m} €/l el {fecha}. Gráfica semanal con datos oficiales de MITECO."
- **Contenido** (`HistoricoArea`): breadcrumbs; H1; párrafo `buildAreaIntro`; 4 tarjetas (G95 y Diésel: precio actual con variación anual; máximo y mínimo históricos con fecha); `PriceHistoryChart`; H2 "Precio medio por año" con `<table>` (año × 4 carburantes); H2 de enlaces relacionados; nota de metodología ("Cada punto es el precio medio de todas las gasolineras del área el lunes de esa semana. Fuente: MITECO."), con la fecha del último dato.
- **Enlaces internos**: España → las 19 comunidades y las 14 marcas; comunidad → sus provincias (las de `parentSlug` igual) y España; provincia → su comunidad, España y `/provincia/[provincia]` (precios de hoy); marca → las otras marcas y España.
- **JSON-LD**: `BreadcrumbList` (existente) y `Dataset`: `name`, `description`, `url`, `temporalCoverage` (`{primera}/{última}`), `spatialCoverage` (`Place` con el nombre; España para marcas), `variableMeasured` (los 4 carburantes, "€/l"), `isBasedOn` (URL de MITECO), `creator` (`Organization` "Ododex"), `dateModified`.
- **Sitemap** (`src/app/sitemap.ts`): las URLs de histórico desde el índice, con `lastModified` = última semana.
- **Enlaces desde páginas existentes**: `Footer` ("Histórico de precios" → `/historico`); home (un enlace "Ver evolución histórica" junto a las estadísticas); `/provincia/[provincia]` (enlace a su página de histórico).
- Sin datos (`getHistoryIndex()` null): `generateStaticParams` devuelve `[]` y `/historico` muestra el aviso "El histórico todavía no se ha generado".

### H7 — Histórico en la ficha de gasolinera (depende de H1, H5)

- `src/components/StationHistory.tsx` (`'use client'`), insertado en `src/app/gasolinera/[slug]/page.tsx` como sección "Evolución del precio en esta gasolinera" con props `{ stationId, idProvincia, provinciaSlug, provinciaName, stationName }`.
- Carga al montar las particiones del año actual y el anterior desde `${NEXT_PUBLIC_HISTORICO_BASE_URL ?? '/historico-estaciones'}/{idProvincia}/{year}.json` (un 404 de un año = ese año sin datos, no error). Botón "Ver desde 2016" que carga el resto de años (máx. 4 peticiones simultáneas). Une con `mergeStationPartitions` y pinta `PriceHistoryChart` (rango por defecto: Todo lo cargado).
- Estados: cargando (esqueleto de la altura de la gráfica), error de red (mensaje + Reintentar), sin datos ("No hay histórico para esta gasolinera"), listo.
- Debajo, enlace a `/historico/provincia/{provinciaSlug}`.

## H.5 Orden de implementación

1. H1.
2. H2, H4 y H5 en paralelo (ficheros disjuntos; cada uno prueba solo sus ficheros de test).
3. H3. Después la sesión principal ejecuta `npm run historico` (unas 470 descargas, ~1 h) para tener datos reales, y commitea `data/historico/indice.json` y `data/historico/areas/`.
4. H6 y H7 en paralelo (H6 es el único que toca `seo.ts`, `sitemap.ts`, `Footer.tsx`, la home y la página de provincia; H7 solo la ficha y su componente).
5. Integración: verificación en pantalla (escritorio y móvil), README.

## H.6 Configuración

| Variable | Uso | Por defecto |
|---|---|---|
| `NEXT_PUBLIC_HISTORICO_BASE_URL` | Base de las particiones por gasolinera que lee el navegador | `/historico-estaciones` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Subida con `--subir` | Sin valor; obligatorias solo con `--subir`/`--subir-todo` |

El bucket R2 necesita acceso público (dominio propio o `r2.dev`) y CORS que permita `GET` desde el dominio de la web.

## H.7 Diseño de interfaz

- Paleta y componentes existentes (tarjetas `--bg-card`, borde `--border-color`, naranja `--orange-primary`).
- Gráfica a ancho completo de la tarjeta; en móvil 260 px de alto; botones de carburante y rango en filas desplazables en horizontal (`.scrollbar-none`), 40 px de alto.
- Tarjetas de cifras en rejilla de 2 columnas en móvil y 4 en escritorio.
- Tabla anual con desplazamiento horizontal dentro de su contenedor en móvil.

---

# Parte 3 — Textos legales, consentimiento de cookies y marca Ododex

## L.1 Objetivo y alcance

### Qué hace

- Añade las páginas **Aviso legal** (`/aviso-legal`), **Privacidad** (`/privacidad`) y **Cookies** (`/cookies`), con los datos del titular leídos de `config/titular.json`, igual que calculadora-impuestos (Ododex).
- Prepara la web para Google AdSense: carga el script solo si `NEXT_PUBLIC_ADSENSE_CLIENT` es válida, publica `/ads.txt` y añade en el pie el botón **"Configurar cookies"**. El aviso de consentimiento (IAB TCF v2.2, certificado por Google) lo sirve el propio script de AdSense y se configura en la consola de AdSense (Privacidad y mensajes); no hay banner propio.
- Quita las frases que dan a entender que la web es oficial o está respaldada por el Ministerio, cambia la marca de los títulos a **Ododex** y añade el aviso de exactitud de precios.
- Sirve el CSS de Leaflet desde la propia web (hoy viene de `unpkg.com`, un tercero que recibe la IP del visitante).

### Qué no hace

- No coloca bloques de anuncios en las páginas (solo el script; con los anuncios automáticos de AdSense o bloques que se decidirán aparte).
- No cambia el proveedor de teselas del mapa (pendiente aparte; la política de privacidad declara los actuales).
- No es asesoramiento jurídico: los textos siguen el modelo de calculadora-impuestos y conviene que los revise un profesional.

## L.2 Módulos

### L1 — `src/lib/legal.ts` y `config/` (datos del titular)

- Port literal de `calculadora-impuestos/lib/legal.ts` (mismos tipos `Titular`/`TipoTitular`, `getTitular`, `ficheroTitular`, `camposPendientes`, `valorOPendiente`, `FECHA_TEXTOS_LEGALES`), adaptando solo comillas e imports al estilo del proyecto.
- `config/titular.example.json` (en git, campos vacíos) y `config/titular.json` en `.gitignore` (datos personales; sin él las páginas muestran `[pendiente: campo]`).
- **Aceptación:** `tests/legal.test.ts` con directorio temporal: lee el real si existe y la plantilla si no; error claro con tipo inválido o campo ausente; `camposPendientes` (registroMercantil solo para empresa); `valorOPendiente`.

### L2 — Páginas legales

- `src/app/aviso-legal/page.tsx`, `src/app/privacidad/page.tsx`, `src/app/cookies/page.tsx`: estructura y tono de las de calculadora-impuestos (`robots: { index: false, follow: true }`, canonical, breadcrumbs, fecha de revisión), con estilos de gasolineras (tarjeta `--bg-card`, tipografía existente). Contenido adaptado a esta web:
  - **Aviso legal:** titular (LSSI art. 10); objeto (comparador de precios de carburantes y su histórico); **fuente de los datos**: Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO), reutilizados según la normativa de reutilización de la información del sector público, citando fuente y fecha, **sin vinculación ni respaldo del Ministerio**; **exactitud**: los precios son los comunicados por las estaciones a MITECO y pueden no coincidir con el surtidor; el histórico es el precio de cada lunes; **marcas**: nombres y logotipos pertenecen a sus titulares y se usan solo para identificar la estación; propiedad intelectual del sitio; mapas © OpenStreetMap contributors y Esri; legislación española.
  - **Privacidad:** responsable (titular); no hay registro de usuarios ni formularios; **"Cerca de mí"**: la ubicación se usa solo en el navegador para calcular distancias y no se envía a ningún servidor; **datos técnicos** que reciben terceros al cargar recursos (IP, navegador): proveedores de teselas del mapa (OpenStreetMap, Esri), almacenamiento del histórico por gasolinera (Cloudflare R2) y, si está activado, Google AdSense (con su base legal: consentimiento); conservación, derechos (acceso, rectificación, supresión, oposición, limitación, portabilidad) por correo al titular y reclamación ante la AEPD.
  - **Cookies:** técnicas/preferencias: `localStorage` `ododex-theme` (tema claro/oscuro, exenta de consentimiento por ser una preferencia pedida por el usuario); publicidad: cookies de Google AdSense, solo con consentimiento mediante el aviso de Google; cómo cambiar la elección ("Configurar cookies" en el pie) y cómo borrarlas en el navegador. Si AdSense no está configurado, la página lo dice y omite el apartado de publicidad.

### L3 — AdSense y consentimiento

- `src/components/AdSenseScript.tsx` y `src/components/ConsentSettingsButton.tsx`: port de calculadora-impuestos (validación `ca-pub-` + 16 dígitos, `next/script` `afterInteractive`, botón que llama a `googlefc.showRevocationMessage`).
- `src/app/layout.tsx`: incluye `<AdSenseScript />`.
- `src/app/ads.txt/route.ts`: `GET` devuelve `text/plain` con `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` si hay cliente válido; si no, 404. `dynamic = 'force-static'`.
- `src/components/Footer.tsx`: enlaces Aviso legal, Privacidad, Cookies y, si hay cliente AdSense, el botón "Configurar cookies"; texto de fuente: "Datos: Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO). Ododex no está vinculado al Ministerio." y "Los precios pueden no coincidir con los del surtidor."
- `.env.example`: `NEXT_PUBLIC_ADSENSE_CLIENT=` documentada.
- **Aceptación:** `tests/adsense.test.ts` para la validación del identificador y el contenido de `ads.txt` (función pura exportada `buildAdsTxt(client)`).

### L4 — Marca y textos

- `src/lib/site.ts`: `SITE_NAME = 'Ododex'` (ya existe).
- `src/app/layout.tsx`: plantilla de título `'%s | Ododex'`, `openGraph.siteName: 'Ododex'`; título por defecto "Precio de la gasolina hoy en España: gasolineras más baratas | Ododex".
- Quitar en todas las páginas y metadatos las expresiones "Datos verificados del Ministerio", "(MITECO)" usado como marca en títulos, "Fuente oficial" y similares que sugieran carácter oficial; sustituir por "Datos oficiales de MITECO" (los datos sí son oficiales; la web no). Las páginas cuyo `title` ya termina en "| Precios MITECO" se dejan si solo describen la fuente.
- Leaflet: CSS importado desde el paquete (`import 'leaflet/dist/leaflet.css'` en el componente cliente del mapa o en `layout.tsx`) y eliminado el `<link>` a unpkg.

## L.3 Orden

1. L1 + L3 + L4 (un encargo; ficheros disjuntos de L2 salvo `Footer.tsx`, que lo hace este).
2. L2.
3. Verificación en pantalla (claro/oscuro, móvil) y commit.

## L.4 Configuración

| Variable / fichero | Uso | Por defecto |
|---|---|---|
| `config/titular.json` | Datos del titular para las páginas legales | Si falta, se usa `config/titular.example.json` y se muestran marcadores |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Identificador de editor de AdSense (`ca-pub-` + 16 dígitos) | Vacío: sin AdSense, sin `ads.txt` y sin botón "Configurar cookies" |
