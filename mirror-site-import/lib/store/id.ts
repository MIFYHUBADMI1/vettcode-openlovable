/**
 * Standalone ID helper. Kept in its own module (rather than store.ts) so
 * both store.ts and mongo-store.ts can import it without creating a
 * circular dependency between the DataStore interface and its
 * implementation.
 */
export function cryptoId() {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`
}
