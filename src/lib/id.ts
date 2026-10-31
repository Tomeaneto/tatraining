const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/** UUID v4 — o mesmo formato dos ids no Supabase. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Converte ids antigos (`w-<uuid>`, `bc-<uuid>` ou o formato sem crypto) em UUID.
 * Ids que já são UUID passam direto.
 */
export function toUuid(id: string): string {
  if (isUuid(id)) return id;
  const tail = id.slice(id.indexOf('-') + 1);
  return isUuid(tail) ? tail : newId();
}
