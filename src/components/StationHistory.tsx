'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { HISTORY_START_DATE, mergeStationPartitions, yearOfIso } from '@/lib/historicoFormat';
import type { StationPartitionFile } from '@/lib/historicoFormat';
import {
  hasAnyPrice,
  listMissingYears,
  listRecentYears,
  loadPartitions,
} from '@/lib/stationHistoryLoader';
import type { FetchPartition, StationHistoryMerged } from '@/lib/stationHistoryLoader';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';

interface StationHistoryProps {
  stationId: string;
  idProvincia: string;
  provinciaSlug: string;
  provinciaName: string;
  stationName: string;
}

type StationHistoryStatus = 'loading' | 'error' | 'ready';
type StationHistoryScope = 'recent' | 'all';

const STATION_HISTORY_DEFAULT_BASE_URL = '/historico-estaciones';
const STATION_HISTORY_HTTP_NOT_FOUND = 404;
const STATION_HISTORY_TRAILING_SLASHES = /\/+$/;
const STATION_HISTORY_EMPTY_TEXT = 'No hay histórico para esta gasolinera';
const STATION_HISTORY_ERROR_TEXT = 'No se pudo cargar el histórico de esta gasolinera.';
const STATION_HISTORY_PARTIAL_ERROR_TEXT = 'No se pudieron cargar todos los años.';
const STATION_HISTORY_SKELETON_CLASS = 'h-[260px] sm:h-[320px]';
const STATION_HISTORY_BUTTON_CLASS =
  'min-h-11 px-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-xs font-bold text-[var(--text-main)] transition-colors disabled:opacity-60';

function stationHistoryBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_HISTORICO_BASE_URL || STATION_HISTORY_DEFAULT_BASE_URL;
  return base.replace(STATION_HISTORY_TRAILING_SLASHES, '');
}

function stationHistoryFetcher(idProvincia: string, signal: AbortSignal): FetchPartition {
  const base = stationHistoryBaseUrl();
  return async (year) => {
    const response = await fetch(`${base}/${idProvincia}/${year}.json`, { signal });
    if (response.status === STATION_HISTORY_HTTP_NOT_FOUND) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status} al pedir el año ${year}`);
    return (await response.json()) as StationPartitionFile;
  };
}

/** Sección de la ficha con la evolución semanal del precio de una gasolinera. */
export function StationHistory({
  stationId,
  idProvincia,
  provinciaSlug,
  provinciaName,
  stationName,
}: StationHistoryProps) {
  const [status, setStatus] = useState<StationHistoryStatus>('loading');
  const [merged, setMerged] = useState<StationHistoryMerged | null>(null);
  const [scope, setScope] = useState<StationHistoryScope>('recent');
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [partialError, setPartialError] = useState(false);
  const filesByYear = useRef(new Map<number, StationPartitionFile>());
  const requestedYears = useRef(new Set<number>());

  useEffect(() => {
    filesByYear.current = new Map();
    requestedYears.current = new Set();
    setScope('recent');
  }, [stationId, idProvincia]);

  useEffect(() => {
    const controller = new AbortController();
    // El año actual se lee aquí y no en el render para no romper la hidratación.
    const currentYear = new Date().getFullYear();
    const wanted =
      scope === 'all'
        ? listMissingYears(currentYear, Array.from(requestedYears.current))
        : listRecentYears(currentYear).filter((year) => !requestedYears.current.has(year));

    async function stationHistoryLoad(): Promise<void> {
      try {
        const files = await loadPartitions(wanted, stationHistoryFetcher(idProvincia, controller.signal));
        if (controller.signal.aborted) return;
        files.forEach((file) => filesByYear.current.set(file.year, file));
        wanted.forEach((year) => requestedYears.current.add(year));
        setMerged(mergeStationPartitions(Array.from(filesByYear.current.values()), stationId));
        setPartialError(false);
        setStatus('ready');
      } catch (error) {
        // Una petición fallida o una partición corrupta se muestra como error con "Reintentar".
        if (controller.signal.aborted) return;
        console.error('Error al cargar el histórico de la gasolinera', error);
        // Con años ya cargados se conserva la gráfica y solo se avisa del fallo.
        if (requestedYears.current.size > 0) setPartialError(true);
        else setStatus('error');
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false);
      }
    }

    stationHistoryLoad();
    return () => controller.abort();
  }, [stationId, idProvincia, scope, attempt]);

  function stationHistoryRetry(): void {
    if (status === 'error') setStatus('loading');
    setPartialError(false);
    setLoadingMore(scope === 'all');
    setAttempt((value) => value + 1);
  }

  function stationHistoryShowAll(): void {
    setLoadingMore(true);
    setScope('all');
  }

  const startYear = yearOfIso(HISTORY_START_DATE);
  const hasData = useMemo(() => merged !== null && hasAnyPrice(merged), [merged]);
  const canShowAll = status === 'ready' && (scope === 'recent' || loadingMore);

  return (
    <div className="space-y-4">
      {status === 'loading' && (
        <div
          role="status"
          aria-label="Cargando histórico"
          className={`${STATION_HISTORY_SKELETON_CLASS} w-full rounded-xl bg-[var(--bg-input)] animate-pulse`}
        />
      )}

      {status === 'error' && (
        <div role="alert" className="space-y-3 text-sm text-[var(--text-muted)]">
          <p>{STATION_HISTORY_ERROR_TEXT}</p>
          <button type="button" onClick={stationHistoryRetry} className={STATION_HISTORY_BUTTON_CLASS}>
            Reintentar
          </button>
        </div>
      )}

      {status === 'ready' && !hasData && (
        <p className="text-sm text-[var(--text-muted)]">{STATION_HISTORY_EMPTY_TEXT}</p>
      )}

      {status === 'ready' && hasData && merged && (
        <PriceHistoryChart
          weeks={merged.weeks}
          series={merged.series}
          title={`Evolución del precio en ${stationName}`}
          defaultRange="all"
        />
      )}

      {partialError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>{STATION_HISTORY_PARTIAL_ERROR_TEXT}</span>
          <button type="button" onClick={stationHistoryRetry} className={STATION_HISTORY_BUTTON_CLASS}>
            Reintentar
          </button>
        </div>
      )}

      {canShowAll && (
        <button
          type="button"
          onClick={stationHistoryShowAll}
          disabled={loadingMore}
          className={STATION_HISTORY_BUTTON_CLASS}
        >
          {loadingMore ? 'Cargando…' : `Ver desde ${startYear}`}
        </button>
      )}

      <Link
        href={`/historico/provincia/${provinciaSlug}`}
        className="inline-block text-xs font-bold text-[var(--orange-primary)] hover:underline"
      >
        Ver la evolución en {provinciaName}
      </Link>
    </div>
  );
}
