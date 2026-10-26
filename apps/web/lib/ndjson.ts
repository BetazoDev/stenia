import 'server-only';

/**
 * Respuesta NDJSON para tareas largas (rutina, plan de comidas). La tarea no depende de la conexión: si el teléfono
 * se bloquea o cambia de app y Safari corta la petición («Load failed»), sigue en el servidor y su resultado se
 * guarda igual. Un latido cada 10 s evita que proxies o el navegador cierren una respuesta que no envía bytes.
 */
export function ndjsonResponse<E>(
  run: (send: (event: E) => void) => Promise<void>,
  toError: (error: unknown) => E,
): Response {
  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        } catch {
          open = false;
        }
      };
      const heartbeat = setInterval(() => write({ stage: 'ping', message: '' }), 10_000);
      void run((event) => write(event))
        .catch((error) => write(toError(error)))
        .finally(() => {
          clearInterval(heartbeat);
          if (!open) return;
          open = false;
          try {
            controller.close();
          } catch {
            // El cliente ya se fue.
          }
        });
    },
    cancel() {
      open = false;
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
