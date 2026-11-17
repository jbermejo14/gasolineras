import type { FuelType } from '@/lib/miteco';
import { getStationBrand } from '@/lib/brands';
import type { EstacionLigera } from '@/lib/stationPayload';

interface ClusterSizeTier {
  /** El grupo usa este nivel si su número de miembros es menor que este umbral. */
  maxCountExclusive: number;
  modifier: string;
  sizePx: number;
}

/** Niveles de tamaño de burbuja, de menor a mayor; el último no tiene tope. */
const CLUSTER_SIZE_TIERS: readonly ClusterSizeTier[] = [
  { maxCountExclusive: 10, modifier: 'small', sizePx: 34 },
  { maxCountExclusive: 100, modifier: 'medium', sizePx: 46 },
  { maxCountExclusive: Infinity, modifier: 'large', sizePx: 56 },
];

const PIN_ICON_SIZE: [number, number] = [112, 38];
const PIN_LOGO_SIZE_PX = 14;
const PRICE_DECIMALS = 3;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto de datos externos antes de insertarlo en HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Precio mostrado: el del carburante elegido, o gasolina95 y luego diésel como alternativa. */
export function resolveStationPrice(station: EstacionLigera, fuel: FuelType): number | null {
  return station.precios[fuel] ?? station.precios.gasolina95 ?? station.precios.diesel ?? null;
}

/** Precio con coma decimal (formato español), p. ej. "1,234". */
function formatPrice(price: number): string {
  return price.toFixed(PRICE_DECIMALS).replace('.', ',');
}

function findClusterSizeTier(count: number): ClusterSizeTier {
  return CLUSTER_SIZE_TIERS.find((tier) => count < tier.maxCountExclusive) ?? CLUSTER_SIZE_TIERS[CLUSTER_SIZE_TIERS.length - 1];
}

export interface ClusterIconSpec {
  className: string;
  sizePx: number;
  html: string;
  /** Texto accesible de la burbuja. */
  title: string;
}

/** Contenido, clase y tamaño de la burbuja de un grupo de estaciones. */
export function buildClusterIconSpec(count: number, minPrice: number | null): ClusterIconSpec {
  const tier = findClusterSizeTier(count);
  const priceLine =
    minPrice === null ? '' : `<span class="station-cluster__price">${formatPrice(minPrice)}€</span>`;
  return {
    className: `station-cluster station-cluster--${tier.modifier}`,
    sizePx: tier.sizePx,
    html: `<span class="station-cluster__count">${count.toLocaleString('es-ES')}</span>${priceLine}`,
    title: `${count} gasolineras`,
  };
}

export interface PinIconSpec {
  html: string;
  iconSize: [number, number];
}

/** Contenido del pin de una estación suelta: logo de la marca (si la hay), rótulo y precio. */
export function buildPinIconSpec(station: EstacionLigera, price: number | null, isHighlight: boolean): PinIconSpec {
  const brand = getStationBrand(station.rotulo);
  const highlightClass = isHighlight ? ' custom-station-pin--highlight' : '';
  const logo = brand
    ? `<img class="custom-station-pin__logo" src="${escapeHtml(brand.logo)}" alt="" width="${PIN_LOGO_SIZE_PX}" height="${PIN_LOGO_SIZE_PX}">`
    : '';
  const label = price === null ? '⛽' : `${formatPrice(price)}€`;
  return {
    html:
      `<div class="custom-station-pin${highlightClass}">` +
      `<span class="custom-station-pin__head">${logo}<span class="custom-station-pin__name">${escapeHtml(station.rotulo)}</span></span>` +
      `<span class="custom-station-pin__price">${label}</span>` +
      `</div>`,
    iconSize: PIN_ICON_SIZE,
  };
}

/** HTML del popup de una estación; se genera solo al abrirlo. */
export function buildStationPopupHtml(station: EstacionLigera, price: number | null): string {
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
  const fichaUrl = `/gasolinera/${encodeURIComponent(station.id)}-${encodeURIComponent(station.slug)}`;
  const priceText = price === null ? 'Consultar' : `${formatPrice(price)} €/l`;
  return `
    <div class="station-popup">
      <div class="station-popup__name">${escapeHtml(station.rotulo)}</div>
      <div class="station-popup__address">${escapeHtml(station.direccion)}, ${escapeHtml(station.municipio)}</div>
      <div class="station-popup__price">${priceText}</div>
      <div class="station-popup__actions">
        <a href="${fichaUrl}" class="station-popup__link station-popup__link--primary">Ver Ficha</a>
        <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="station-popup__link station-popup__link--secondary">Ruta GPS</a>
      </div>
    </div>
  `;
}
