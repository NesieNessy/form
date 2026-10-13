let seq = 0;

/** Short id for transient UI state (wizard rows). Not for anything that is stored. */
export function generateId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

type CryptoLike = { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array };

/**
 * UUID v4 for stored entities. Generated on the device so records can be
 * created offline and a retried upload is an upsert, never a duplicate.
 */
export function newUuid(): string {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (c?.randomUUID) return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}
