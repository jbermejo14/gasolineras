/** Formato del identificador de editor de AdSense: `ca-pub-` y 16 dígitos. */
export const ADSENSE_CLIENT_PATTERN = /^ca-pub-\d{16}$/;

const ADSENSE_CLIENT_PREFIX = 'ca-';
const ADSENSE_RELATIONSHIP = 'DIRECT';
// Identificador de certificación de Google que exige ads.txt.
const ADSENSE_CERTIFICATION_ID = 'f08c47fec0942fa0';

/** Indica si el identificador tiene el formato `ca-pub-<16 dígitos>`. */
export function isValidAdSenseClient(client: string): boolean {
  return ADSENSE_CLIENT_PATTERN.test(client);
}

/** Identificador de AdSense configurado en el entorno, o null si falta o no es válido. */
export function getAdSenseClient(): string | null {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
  return isValidAdSenseClient(client) ? client : null;
}

/** Contenido de ads.txt para un identificador válido (`ca-pub-X` se publica como `pub-X`). */
export function buildAdsTxt(client: string): string {
  if (!isValidAdSenseClient(client)) {
    throw new Error(`Identificador de AdSense no válido: "${client}". Debe ser ca-pub- seguido de 16 dígitos.`);
  }
  const publisher = client.slice(ADSENSE_CLIENT_PREFIX.length);
  return `google.com, ${publisher}, ${ADSENSE_RELATIONSHIP}, ${ADSENSE_CERTIFICATION_ID}\n`;
}
