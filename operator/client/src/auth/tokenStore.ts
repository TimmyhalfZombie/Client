// client/src/auth/tokenStore.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Unified token store
 * - Primary storage: SecureStore (atomic blob with {access, refresh})
 * - Migrates from legacy keys in SecureStore/AsyncStorage:
 *     • 'auth_access_token_v1', 'auth_refresh_token_v1'
 *     • single-token keys: 'token', 'accessToken', 'idToken', 'jwt'
 */

const STORAGE_KEY = 'auth_tokens_v2';           // atomic blob {access, refresh}
const LEGACY_ACCESS_KEY = 'auth_access_token_v1';
const LEGACY_REFRESH_KEY = 'auth_refresh_token_v1';
const SINGLE_TOKEN_KEYS = ['token', 'accessToken', 'idToken', 'jwt'];

let accessToken: string | null = null;
let refreshToken: string | null = null;

let ready = false;
let inFlight: Promise<void> | null = null;

type PersistOpts = { persist?: boolean };

/* ---------------- helpers ---------------- */
function normalize(v?: string | null): string | null {
  if (!v) return null;
  const t = String(v).trim();
  return t || null;
}

async function readAsyncStorage(key: string): Promise<string | null> {
  try { return (await AsyncStorage.getItem(key)) || null; } catch { return null; }
}
async function writeAsyncStorage(key: string, val: string): Promise<void> {
  try { await AsyncStorage.setItem(key, val); } catch {}
}
async function deleteAsyncStorage(key: string): Promise<void> {
  try { await AsyncStorage.removeItem(key); } catch {}
}

async function ensureLoaded(): Promise<void> {
  if (ready) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      // 1) Try v2 (atomic blob in SecureStore)
      const blob = await SecureStore.getItemAsync(STORAGE_KEY);
      if (blob) {
        try {
          const parsed = JSON.parse(blob);
          accessToken = normalize(parsed?.access);
          refreshToken = normalize(parsed?.refresh);
          ready = true;
          return;
        } catch {
          // fall through to migration
        }
      }

      // 2) Migrate legacy v1 keys (SecureStore)
      const legacyAccess = normalize(await SecureStore.getItemAsync(LEGACY_ACCESS_KEY));
      const legacyRefresh = normalize(await SecureStore.getItemAsync(LEGACY_REFRESH_KEY));
      if (legacyAccess || legacyRefresh) {
        accessToken = legacyAccess;
        refreshToken = legacyRefresh;
      }

      // 3) Migrate single-token keys (SecureStore then AsyncStorage)
      if (!accessToken) {
        for (const k of SINGLE_TOKEN_KEYS) {
          const v =
            normalize(await SecureStore.getItemAsync(k)) ??
            normalize(await readAsyncStorage(k));
          if (v) { accessToken = v; break; }
        }
      }

      // 4) Persist migrated state atomically and clean legacy keys
      if (accessToken || refreshToken) {
        await SecureStore.setItemAsync(
          STORAGE_KEY,
          JSON.stringify({ access: accessToken, refresh: refreshToken })
        );
        // cleanup
        await SecureStore.deleteItemAsync(LEGACY_ACCESS_KEY).catch(() => {});
        await SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY).catch(() => {});
        for (const k of SINGLE_TOKEN_KEYS) {
          await SecureStore.deleteItemAsync(k).catch(() => {});
          await deleteAsyncStorage(k);
        }
      }
    } finally {
      ready = true;
      inFlight = null;
    }
  })();

  return inFlight;
}

async function persistCurrent(): Promise<void> {
  if (accessToken || refreshToken) {
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({ access: accessToken, refresh: refreshToken })
    );
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
  }
}

/* --------- lightweight JWT decoder (no verification, UI-only) --------- */
function base64UrlDecode(input: string): string {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const padded = b64 + '='.repeat(pad);
    if (typeof atob === 'function') {
      // @ts-ignore atob may exist in RN Hermes
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(padded), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } else {
      // @ts-ignore Buffer exists in RN
      return Buffer.from(padded, 'base64').toString('utf8');
    }
  } catch {
    return '';
  }
}
function decodeJwtPayload<T = any>(jwt?: string | null): T | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  const json = base64UrlDecode(parts[1]);
  try { return JSON.parse(json) as T; } catch { return null; }
}

/* ---------------- public API ---------------- */
export const tokens = {
  /** Set both tokens in memory; pass {persist:true} to save immediately. */
  async set(a?: string | null, r?: string | null, options?: PersistOpts) {
    if (a !== undefined) accessToken = normalize(a);
    if (r !== undefined) refreshToken = normalize(r);
    if (options?.persist) await persistCurrent();
  },

  /** Back-compat helper: set only access token (commonly called after login). */
  async setAccess(a: string | null, options?: PersistOpts) {
    accessToken = normalize(a);
    if (options?.persist) await persistCurrent();
  },

  /** Sync getters (use after initTokens/waitUntilReady). */
  getAccess() { return accessToken; },
  getRefresh() { return refreshToken; },

  /** Async getters (auto-load from storage on first call). */
  async getAccessAsync() { await ensureLoaded(); return accessToken; },
  async getRefreshAsync() { await ensureLoaded(); return refreshToken; },

  /** Clear in-memory tokens; optionally remove from storage. */
  clear(opts: PersistOpts = {}) {
    accessToken = null;
    refreshToken = null;
    return opts.persist
      ? SecureStore.deleteItemAsync(STORAGE_KEY)
      : Promise.resolve();
  },

  /** Force-load tokens from storage (idempotent). */
  async loadFromStorage() { await ensureLoaded(); },

  /** Persist current in-memory tokens to storage. */
  async saveToStorage() { await ensureLoaded(); await persistCurrent(); },

  /** Remove all known keys (v2 + legacy) from storage and memory. */
  async clearStorage() {
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(LEGACY_ACCESS_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY).catch(() => {});
    for (const k of SINGLE_TOKEN_KEYS) {
      await SecureStore.deleteItemAsync(k).catch(() => {});
      await deleteAsyncStorage(k);
    }
    accessToken = null;
    refreshToken = null;
    ready = true;
  },

  /** Wait until the store has loaded any persisted tokens. */
  waitUntilReady: ensureLoaded,

  /** Back-compat alias (some code expects initTokens()). */
  initTokens: ensureLoaded,

  /** Synchronous "is loaded" flag. */
  isReady() { return ready; },

  /* -------- UI helpers from access token payload -------- */
  async getUserIdAsync(): Promise<string | null> {
    await ensureLoaded();
    const p = decodeJwtPayload<any>(accessToken);
    const id = p?.id ?? p?.sub ?? p?._id ?? null;
    return id ? String(id) : null;
    },
  async getUserNameAsync(): Promise<string | null> {
    await ensureLoaded();
    const p = decodeJwtPayload<any>(accessToken);
    const name = p?.name ?? p?.username ?? null;
    return name ? String(name) : null;
  },
};

// Named exports for convenience/back-compat with some imports
export const initTokens = tokens.initTokens;
export const setAccess = tokens.setAccess;
export const getAccess = tokens.getAccess;
export const getAccessAsync = tokens.getAccessAsync;
