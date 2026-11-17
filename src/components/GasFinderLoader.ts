'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EstacionLigera, EstacionesPayload } from '@/lib/stationPayload';

const STATIONS_ENDPOINT = '/api/estaciones';
const GENERIC_ERROR_MESSAGE =
  'No se pudieron cargar las gasolineras. Comprueba tu conexión e inténtalo de nuevo.';

export type GasFinderLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stations: EstacionLigera[] };

/** Error de carga con un mensaje apto para mostrar al usuario. */
export class GasFinderLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GasFinderLoadError';
  }
}

async function gasFinderFetchStations(signal: AbortSignal): Promise<EstacionLigera[]> {
  const response = await fetch(STATIONS_ENDPOINT, { signal });
  if (!response.ok) {
    // Un cuerpo no JSON se trata como ausencia de mensaje y se usa el genérico.
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new GasFinderLoadError(body?.error ?? GENERIC_ERROR_MESSAGE);
  }
  const payload = (await response.json()) as Partial<EstacionesPayload> | null;
  if (!Array.isArray(payload?.estaciones)) {
    throw new GasFinderLoadError(GENERIC_ERROR_MESSAGE);
  }
  return payload.estaciones;
}

/** Descarga las estaciones ligeras al montar; `retry` repite la descarga tras un error. */
export function useGasFinderStations(): { state: GasFinderLoadState; retry: () => void } {
  const [state, setState] = useState<GasFinderLoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    gasFinderFetchStations(controller.signal)
      .then((stations) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', stations });
      })
      .catch((err: unknown) => {
        // Abortar al desmontar o reintentar no es un fallo que mostrar.
        if (controller.signal.aborted) return;
        // Solo se muestran los mensajes propios; los de red o JSON inválido son técnicos.
        const message = err instanceof GasFinderLoadError ? err.message : GENERIC_ERROR_MESSAGE;
        setState({ status: 'error', message });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
