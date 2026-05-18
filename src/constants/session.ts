export const CHAT_CACHE_SCHEMA_VERSION = 1;

export const CHAT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const CHAT_CACHE_POLICY = {
  schemaVersion: CHAT_CACHE_SCHEMA_VERSION,
  ttlMs: CHAT_CACHE_TTL_MS,
} as const;
