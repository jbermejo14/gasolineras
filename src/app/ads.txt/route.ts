import { buildAdsTxt, getAdSenseClient } from '@/lib/adsense';

export const dynamic = 'force-static';

const NOT_FOUND_STATUS = 404;
const TEXT_PLAIN = 'text/plain; charset=utf-8';

/** Publica ads.txt si hay cliente de AdSense válido; si no, responde 404. */
export function GET(): Response {
  const client = getAdSenseClient();
  if (!client) return new Response('Not found', { status: NOT_FOUND_STATUS });
  return new Response(buildAdsTxt(client), { headers: { 'Content-Type': TEXT_PLAIN } });
}
