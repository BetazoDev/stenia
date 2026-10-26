/** ¿Se cortó la conexión? Safari dice «Load failed»; Chrome, «Failed to fetch» o «network error». */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /load failed|failed to fetch|network/i.test(error.message))
  );
}
