'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { HISTORY_FUELS } from '@/lib/historicoFormat';
import type { FuelSeries, HistoryFuel } from '@/lib/historicoFormat';
import { formatIsoDateEs, formatMilliEuro } from '@/lib/historicoStats';
import { buildChartGeometry } from '@/lib/priceChartGeometry';
import type { ChartGeometry } from '@/lib/priceChartGeometry';
import { FUEL_SHORT_LABELS } from '@/lib/miteco';

type PriceChartRange = 'year' | 'fiveYears' | 'all';

interface PriceHistoryChartProps {
  weeks: string[];
  series: Partial<Record<HistoryFuel, FuelSeries>>;
  title: string;
  defaultFuels?: HistoryFuel[];
  defaultRange?: PriceChartRange;
}

interface PriceChartSize {
  width: number;
  height: number;
}

const PRICE_CHART_DESKTOP_SIZE: PriceChartSize = { width: 800, height: 320 };
const PRICE_CHART_MOBILE_SIZE: PriceChartSize = { width: 360, height: 260 };
const PRICE_CHART_MOBILE_BREAKPOINT = 640;
const PRICE_CHART_PADDING = { top: 16, right: 16, bottom: 28, left: 56 };
const PRICE_CHART_DEFAULT_FUELS: HistoryFuel[] = ['gasolina95', 'diesel'];
const PRICE_CHART_DEFAULT_RANGE: PriceChartRange = 'year';
const PRICE_CHART_FUEL_COLORS: Record<HistoryFuel, string> = {
  gasolina95: '#ff6600',
  diesel: '#3b82f6',
  gasolina98: '#a855f7',
  dieselPremium: '#22c55e',
};
const PRICE_CHART_RANGES: {
  value: PriceChartRange;
  label: string;
  weeks: number | null;
}[] = [
  { value: 'year', label: '1 año', weeks: 52 },
  { value: 'fiveYears', label: '5 años', weeks: 260 },
  { value: 'all', label: 'Todo', weeks: null },
];
const PRICE_CHART_EMPTY_TEXT = 'Todavía no hay datos históricos para mostrar.';
const PRICE_CHART_LINE_WIDTH = 2;
const PRICE_CHART_POINT_RADIUS = 4;
const PRICE_CHART_TICK_LABEL_OFFSET = 8;
const PRICE_CHART_X_LABEL_OFFSET = 16;
const PRICE_CHART_TOOLTIP_FLIP_RATIO = 0.6;
const PRICE_CHART_PERCENT = 100;
const PRICE_CHART_AXIS_FONT_SIZE = 11;
const PRICE_CHART_GRID_STROKE_WIDTH = 1;
const PRICE_CHART_CURSOR_DASHARRAY = '4 3';
const PRICE_CHART_TOOLTIP_OFFSET_PX = 12;
const PRICE_CHART_KEYBOARD_HELP =
  'Usa las flechas izquierda y derecha para recorrer las semanas; Escape para cerrar.';
const PRICE_CHART_BUTTON_CLASS =
  'shrink-0 min-h-10 px-3 rounded border text-xs font-bold transition-colors whitespace-nowrap';
const PRICE_CHART_BUTTON_ON_CLASS =
  'bg-[var(--orange-primary)] border-[var(--orange-primary)] text-black';
const PRICE_CHART_BUTTON_OFF_CLASS =
  'bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]';

function priceChartHasData(values: FuelSeries | undefined): values is FuelSeries {
  return values !== undefined && values.some((value) => value !== null);
}

function priceChartSizeForWidth(containerWidth: number): PriceChartSize {
  return containerWidth < PRICE_CHART_MOBILE_BREAKPOINT
    ? PRICE_CHART_MOBILE_SIZE
    : PRICE_CHART_DESKTOP_SIZE;
}

/** Recorta semanas y series juntas: las últimas N semanas hasta la última con algún dato. */
function priceChartSliceRange(
  weeks: string[],
  series: Partial<Record<HistoryFuel, FuelSeries>>,
  range: PriceChartRange
): { weeks: string[]; series: Partial<Record<HistoryFuel, FuelSeries>> } {
  const limit = PRICE_CHART_RANGES.find((option) => option.value === range)?.weeks ?? null;
  if (limit === null) return { weeks, series };
  let end = weeks.length;
  while (end > 0 && !HISTORY_FUELS.some((fuel) => series[fuel]?.[end - 1] != null)) end--;
  const start = Math.max(0, end - limit);
  const sliced: Partial<Record<HistoryFuel, FuelSeries>> = {};
  for (const fuel of HISTORY_FUELS) {
    const values = series[fuel];
    if (values) sliced[fuel] = values.slice(start, end);
  }
  return { weeks: weeks.slice(start, end), series: sliced };
}

function priceChartLastPrice(values: FuelSeries): number | null {
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index] !== null) return values[index];
  }
  return null;
}

/** Mide el contenedor y devuelve el tamaño del viewBox; en el servidor y el primer render, 800×320. */
function usePriceChartSize(containerRef: React.RefObject<HTMLDivElement | null>): PriceChartSize {
  const [size, setSize] = useState<PriceChartSize>(PRICE_CHART_DESKTOP_SIZE);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize(priceChartSizeForWidth(entry.contentRect.width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);
  return size;
}

function PriceChartToggleRow<T extends string>({
  label,
  options,
  isActive,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string; color?: string }[];
  isActive: (value: T) => boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto scrollbar-none">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={isActive(option.value)}
          onClick={() => onSelect(option.value)}
          className={`${PRICE_CHART_BUTTON_CLASS} ${
            isActive(option.value) ? PRICE_CHART_BUTTON_ON_CLASS : PRICE_CHART_BUTTON_OFF_CLASS
          }`}
        >
          {option.color && (
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: option.color }}
            />
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PriceChartAxes({ geometry, width }: { geometry: ChartGeometry; width: number }) {
  return (
    <g fontSize={PRICE_CHART_AXIS_FONT_SIZE} fill="var(--text-muted)">
      {geometry.yTicks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={PRICE_CHART_PADDING.left}
            x2={width - PRICE_CHART_PADDING.right}
            y1={tick.y}
            y2={tick.y}
            stroke="var(--border-color)"
            strokeWidth={PRICE_CHART_GRID_STROKE_WIDTH}
          />
          <text
            x={PRICE_CHART_PADDING.left - PRICE_CHART_TICK_LABEL_OFFSET}
            y={tick.y}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {geometry.xTicks.map((tick) => (
        <text
          key={`${tick.label}-${tick.x}`}
          x={tick.x}
          y={geometry.yTicks[0].y + PRICE_CHART_X_LABEL_OFFSET}
          textAnchor="middle"
        >
          {tick.label}
        </text>
      ))}
    </g>
  );
}

function PriceChartLines({
  geometry,
  fuels,
  activeIndex,
  cursorX,
  height,
}: {
  geometry: ChartGeometry;
  fuels: HistoryFuel[];
  activeIndex: number | null;
  cursorX: number | null;
  height: number;
}) {
  return (
    <g>
      {geometry.paths.map((path) => (
        <path
          key={path.fuel}
          d={path.d}
          fill="none"
          stroke={PRICE_CHART_FUEL_COLORS[path.fuel]}
          strokeWidth={PRICE_CHART_LINE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {activeIndex !== null && cursorX !== null && (
        <line
          x1={cursorX}
          x2={cursorX}
          y1={PRICE_CHART_PADDING.top}
          y2={height - PRICE_CHART_PADDING.bottom}
          stroke="var(--text-muted)"
          strokeDasharray={PRICE_CHART_CURSOR_DASHARRAY}
        />
      )}
      {activeIndex !== null &&
        fuels.map((fuel) => {
          const point = geometry.pointAt(activeIndex, fuel);
          return point ? (
            <circle
              key={fuel}
              cx={point.x}
              cy={point.y}
              r={PRICE_CHART_POINT_RADIUS}
              fill={PRICE_CHART_FUEL_COLORS[fuel]}
              stroke="var(--bg-card)"
              strokeWidth={PRICE_CHART_LINE_WIDTH}
            />
          ) : null;
        })}
    </g>
  );
}

function PriceChartTooltip({
  week,
  rows,
  leftRatio,
}: {
  week: string;
  rows: { fuel: HistoryFuel; value: number | null }[];
  leftRatio: number;
}) {
  const flip = leftRatio > PRICE_CHART_TOOLTIP_FLIP_RATIO;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-main)] shadow-lg"
      style={{
        left: `${leftRatio * PRICE_CHART_PERCENT}%`,
        transform: flip
          ? `translateX(calc(-100% - ${PRICE_CHART_TOOLTIP_OFFSET_PX}px))`
          : `translateX(${PRICE_CHART_TOOLTIP_OFFSET_PX}px)`,
      }}
    >
      <div className="font-bold mb-1">{formatIsoDateEs(week)}</div>
      {rows.map((row) => (
        <div key={row.fuel} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: PRICE_CHART_FUEL_COLORS[row.fuel] }}
          />
          <span className="text-[var(--text-muted)]">{FUEL_SHORT_LABELS[row.fuel]}</span>
          <span className="font-bold ml-auto">
            {row.value === null ? 'Sin dato' : formatMilliEuro(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function priceChartKeyboardIndex(
  key: string,
  current: number | null,
  count: number
): number | null {
  if (key === 'Escape') return null;
  const last = count - 1;
  if (key === 'ArrowLeft') return current === null ? last : Math.max(0, current - 1);
  if (key === 'ArrowRight') return current === null ? last : Math.min(last, current + 1);
  return current;
}

function priceChartFirstCursorX(
  geometry: ChartGeometry,
  fuels: HistoryFuel[],
  index: number | null
): number | null {
  if (index === null) return null;
  for (const fuel of fuels) {
    const point = geometry.pointAt(index, fuel);
    if (point) return point.x;
  }
  return null;
}

function priceChartRowsAt(
  fuels: HistoryFuel[],
  series: Partial<Record<HistoryFuel, FuelSeries>>,
  index: number
): { fuel: HistoryFuel; value: number | null }[] {
  return fuels.map((fuel) => ({ fuel, value: series[fuel]?.[index] ?? null }));
}

/** Texto para lectores de pantalla del punto activo: fecha y precio de cada carburante. */
function priceChartAnnouncement(
  week: string,
  rows: { fuel: HistoryFuel; value: number | null }[]
): string {
  const prices = rows.map(
    (row) =>
      `${FUEL_SHORT_LABELS[row.fuel]}: ${row.value === null ? 'sin dato' : formatMilliEuro(row.value)}`
  );
  return `${formatIsoDateEs(week)}. ${prices.join('. ')}.`;
}

/** Gráfica de evolución de precios en SVG propio, con selector de carburante y rango. */
export function PriceHistoryChart({
  weeks,
  series,
  title,
  defaultFuels = PRICE_CHART_DEFAULT_FUELS,
  defaultRange = PRICE_CHART_DEFAULT_RANGE,
}: PriceHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = usePriceChartSize(containerRef);
  const baseId = useId();
  const [selectedFuels, setSelectedFuels] = useState<HistoryFuel[]>(defaultFuels);
  const [range, setRange] = useState<PriceChartRange>(defaultRange);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const availableFuels = useMemo(
    () => HISTORY_FUELS.filter((fuel) => priceChartHasData(series[fuel])),
    [series]
  );
  const visibleFuels = useMemo(
    () => availableFuels.filter((fuel) => selectedFuels.includes(fuel)),
    [availableFuels, selectedFuels]
  );
  const sliced = useMemo(() => priceChartSliceRange(weeks, series, range), [weeks, series, range]);
  const geometry = useMemo(
    () =>
      buildChartGeometry({
        weeks: sliced.weeks,
        series: visibleFuels.map((fuel) => ({
          fuel,
          values: sliced.series[fuel] ?? [],
        })),
        width: size.width,
        height: size.height,
        padding: PRICE_CHART_PADDING,
      }),
    [sliced, visibleFuels, size]
  );

  if (availableFuels.length === 0 || weeks.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">{PRICE_CHART_EMPTY_TEXT}</p>;
  }

  // Estrecha el índice: tras cambiar de rango podría quedar fuera de las semanas visibles.
  const currentIndex =
    activeIndex !== null && activeIndex < sliced.weeks.length ? activeIndex : null;
  const cursorX = priceChartFirstCursorX(geometry, visibleFuels, currentIndex);
  const activeRows =
    currentIndex === null ? [] : priceChartRowsAt(visibleFuels, sliced.series, currentIndex);
  const activeWeek = currentIndex === null ? undefined : sliced.weeks[currentIndex];

  const toggleFuel = (fuel: HistoryFuel) => {
    setSelectedFuels((current) => {
      if (!current.includes(fuel)) return [...current, fuel];
      // El último carburante activo no se puede desactivar: la gráfica quedaría vacía.
      const remaining = current.filter((entry) => entry !== fuel);
      return remaining.some((entry) => availableFuels.includes(entry)) ? remaining : current;
    });
  };
  const selectRange = (value: PriceChartRange) => {
    setRange(value);
    setActiveIndex(null);
  };
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * size.width;
    setActiveIndex(geometry.indexAtX(x));
  };
  const handleKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const next = priceChartKeyboardIndex(event.key, currentIndex, sliced.weeks.length);
    if (next === currentIndex) return;
    event.preventDefault();
    setActiveIndex(next);
  };

  const description = visibleFuels
    .map((fuel) => {
      const last = priceChartLastPrice(sliced.series[fuel] ?? []);
      return last === null ? null : `${FUEL_SHORT_LABELS[fuel]}: ${formatMilliEuro(last)}`;
    })
    .filter((text) => text !== null)
    .join('. ');
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const helpId = `${baseId}-help`;

  return (
    <div className="flex flex-col gap-3">
      <PriceChartToggleRow
        label="Carburantes"
        options={availableFuels.map((fuel) => ({
          value: fuel,
          label: FUEL_SHORT_LABELS[fuel],
          color: PRICE_CHART_FUEL_COLORS[fuel],
        }))}
        isActive={(fuel) => selectedFuels.includes(fuel)}
        onSelect={toggleFuel}
      />
      <PriceChartToggleRow
        label="Rango de fechas"
        options={PRICE_CHART_RANGES.map(({ value, label }) => ({
          value,
          label,
        }))}
        isActive={(value) => value === range}
        onSelect={selectRange}
      />
      <div ref={containerRef} className="relative w-full">
        {visibleFuels.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{PRICE_CHART_EMPTY_TEXT}</p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${size.width} ${size.height}`}
              role="img"
              tabIndex={0}
              aria-labelledby={`${titleId} ${descId}`}
              aria-describedby={helpId}
              className="block w-full h-auto touch-pan-y focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange-primary)] rounded"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setActiveIndex(null)}
              onKeyDown={handleKeyDown}
              onBlur={() => setActiveIndex(null)}
            >
              <title id={titleId}>{title}</title>
              <desc id={descId}>{description}</desc>
              <PriceChartAxes geometry={geometry} width={size.width} />
              <PriceChartLines
                geometry={geometry}
                fuels={visibleFuels}
                activeIndex={currentIndex}
                cursorX={cursorX}
                height={size.height}
              />
            </svg>
            <p id={helpId} className="sr-only">
              {PRICE_CHART_KEYBOARD_HELP}
            </p>
            <div aria-live="polite" className="sr-only">
              {activeWeek === undefined ? '' : priceChartAnnouncement(activeWeek, activeRows)}
            </div>
            {activeWeek !== undefined && cursorX !== null && (
              <PriceChartTooltip
                week={activeWeek}
                leftRatio={cursorX / size.width}
                rows={activeRows}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PriceHistoryChart;
