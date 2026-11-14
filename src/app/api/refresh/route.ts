import { revalidateTag } from "next/cache";
import { QUOTES_TAG } from "@/lib/config";

let last = 0;
const MIN_INTERVAL_MS = 60_000; // protege las cuotas de las APIs gratuitas

/** Botón "Actualizar": invalida el caché de cotizaciones; la próxima lectura va a las fuentes. */
export async function POST() {
  const now = Date.now();
  if (now - last < MIN_INTERVAL_MS) {
    return Response.json({ revalidated: false, retryInSeconds: Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000) }, { status: 429 });
  }
  last = now;
  revalidateTag(QUOTES_TAG, { expire: 0 });
  return Response.json({ revalidated: true, at: new Date(now).toISOString() });
}
