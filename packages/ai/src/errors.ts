import { APICallError } from 'ai';

/** Convierte errores del proveedor en un mensaje breve y legible en español. */
export function describeAiError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === 401 || status === 403) return 'La API key fue rechazada por el proveedor.';
    if (status === 404) return 'El modelo indicado no existe para este proveedor.';
    if (status === 429) return 'Límite de peticiones alcanzado; intenta de nuevo en unos segundos.';
    if (status && status >= 500) return `El proveedor respondió con un error ${status}.`;
    return error.message.slice(0, 200);
  }
  if (error instanceof Error) {
    if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(error.message)) {
      return 'No se pudo conectar con el proveedor; revisa la URL base y la red.';
    }
    return error.message.slice(0, 200);
  }
  return 'Error desconocido al llamar al proveedor.';
}
