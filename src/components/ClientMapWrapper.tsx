'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Gasolinera } from '@/lib/miteco';

const LeafletMap = dynamic(
  () => import('@/components/LeafletMap').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-xs text-[var(--text-muted)] animate-pulse">
        Cargando mapa interactivo...
      </div>
    ),
  }
);

interface ClientMapWrapperProps {
  stations: Gasolinera[];
  selectedFuel?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  highlightStationId?: string;
}

export function ClientMapWrapper(props: ClientMapWrapperProps) {
  return <LeafletMap {...props} />;
}
