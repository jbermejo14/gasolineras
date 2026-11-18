/** Formato del identificador de editor de AdSense: `ca-pub-` y 16 dígitos. */
export const ADSENSE_CLIENT_PATTERN = /^ca-pub-\d{16}$/;

/** Indica si el identificador tiene el formato `ca-pub-<16 dígitos>`. */
export function isValidAdSenseClient(client: string): boolean {
  return ADSENSE_CLIENT_PATTERN.test(client);
}

/** Identificador de AdSense configurado en el entorno, o null si falta o no es válido. */
export function getAdSenseClient(): string | null {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
  return isValidAdSenseClient(client) ? client : null;
}


/** Formato de la unidad de anuncio de AdSense (`data-ad-slot`): 10 dígitos. */
export const ADSENSE_SLOT_PATTERN = /^\d{10}$/;

/** Indica si la unidad de anuncio tiene exactamente 10 dígitos. */
export function isValidAdSenseSlot(slot: string): boolean {
  return ADSENSE_SLOT_PATTERN.test(slot);
}

/** Unidad de anuncio configurada en el entorno, o null si falta o no es válida. */
export function getAdSenseSlot(): string | null {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? '';
  return isValidAdSenseSlot(slot) ? slot : null;
}
