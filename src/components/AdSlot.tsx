'use client';

import { useEffect, useRef } from 'react';
import { getAdSenseClient, getAdSenseSlot } from '@/lib/adsense';

const AD_SLOT_LABEL = 'Publicidad';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Hueco de anuncio manual. No renderiza nada si falta un cliente válido
 * (NEXT_PUBLIC_ADSENSE_CLIENT) o una unidad válida (NEXT_PUBLIC_ADSENSE_SLOT, 10 dígitos).
 */
export function AdSlot({ className }: { className?: string }) {
  const client = getAdSenseClient();
  const slot = getAdSenseSlot();
  const pushed = useRef(false);

  useEffect(() => {
    // La ref evita el segundo push que provoca el modo estricto al montar dos veces.
    if (!client || !slot || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('No se pudo cargar el anuncio de AdSense', error);
    }
  }, [client, slot]);

  if (!client || !slot) return null;
  return (
    <aside aria-label={AD_SLOT_LABEL} className={className ? `ad-slot ${className}` : 'ad-slot'}>
      <span className="ad-slot__label">{AD_SLOT_LABEL}</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
