import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { NativeModules, Platform } from "react-native";

const STORAGE_KEY = "api_base_url_cache_v1";

let inMemoryBaseUrl: string | null = null;
let inFlight: Promise<string> | null = null;

/* -------------------------------- config -------------------------------- */

function getConfiguredBase(): string | undefined {
  // 1) Expo public env (preferred)
  const envUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_API_URL ||
    (Constants?.manifest?.extra as any)?.EXPO_PUBLIC_API_URL;

  // 2) Back-compat key API_URL (if you configured this in app config)
  const extra: any = Constants.expoConfig?.extra ?? {};
  const fromConfig: string | undefined =
    envUrl || extra.API_URL || (Constants as any)?.manifest?.extra?.API_URL;

  return fromConfig?.replace(/\/+$/, "");
}

function getPlatformFallbacks(): string[] {
  // Keep the common dev targets as fallbacks
  const fallbacks: string[] = [];
  if (Platform.OS === "android") fallbacks.push("http://10.0.2.2:3000");
  if (Platform.OS === "ios") fallbacks.push("http://localhost:3000");
  // Last resort: previous hardcoded LAN style (edit to your LAN if needed)
  fallbacks.push("http://192.168.1.23:3000");
  return fallbacks.map((u) => u.replace(/\/+$/, ""));
}

function getHostDerivedCandidate(): string | undefined {
  try {
    const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
    if (!scriptURL) return undefined;
    const u = new URL(scriptURL);
    const host = u.hostname;
    if (!host) return undefined;
    // If Metro served from a LAN IP or .local hostname, reuse it with port 3000
    const isLanIp = /^(\d+\.){3}\d+$/.test(host);
    const isMdns = host.endsWith(".local");
    if (isLanIp || isMdns) return `http://${host}:3000`;
    return undefined;
  } catch {
    return undefined;
  }
}

/* -------------------------------- probe -------------------------------- */

async function probeBase(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const u = url.replace(/\/$/, "");
    // ✅ Your server health endpoint:
    // server/index.ts exposes GET /api/health → { success: true, message: "Server is healthy" }
    const res = await fetch(`${u}/api/health`, { signal });
    if (!res.ok) return false;
    // Accept any 2xx; prefer success===true if present
    try {
      const data = await res.json();
      return !!(data?.success ?? true);
    } catch {
      return true;
    }
  } catch {
    return false;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error("probe_timeout"));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function generateCommonLanCandidates(): string[] {
  // Probe a small set of common private subnets for :3000
  // Keep short to avoid long delays; expand only if needed.
  const subnets = ["192.168.0", "192.168.1", "10.0.0"];
  const candidates: string[] = [];
  for (const s of subnets) {
    for (let i = 2; i <= 254; i++) {
      candidates.push(`http://${s}.${i}:3000`);
    }
  }
  return candidates.map((u) => u.replace(/\/+$/, ""));
}

async function probeFirstReachable(
  bases: string[],
  timeoutMs: number,
  parallel: number
): Promise<string | null> {
  let index = 0;
  let found: string | null = null;

  async function worker() {
    while (found === null && index < bases.length) {
      const myIndex = index++;
      const b = bases[myIndex];
      try {
        const ok = await withTimeout(
          // Use an AbortController per probe inside withTimeout
          (async () => {
            const controller = new AbortController();
            return probeBase(b, controller.signal);
          })(),
          timeoutMs
        );
        if (ok && found === null) {
          found = b.replace(/\/$/, "");
          return;
        }
      } catch {
        // ignore
      }
    }
  }

  const workers = Array.from({ length: Math.min(parallel, bases.length) }, () => worker());
  await Promise.all(workers);
  return found;
}

/* ------------------------------ resolver ------------------------------- */

export async function resolveApiBaseUrl(): Promise<string> {
  if (inMemoryBaseUrl) return inMemoryBaseUrl;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // 1) Try cached (SecureStore)
    try {
      const cached = (await SecureStore.getItemAsync(STORAGE_KEY)) || "";
      if (cached) {
        const ok = await probeBase(cached, new AbortController().signal);
        if (ok) {
          inMemoryBaseUrl = cached.replace(/\/+$/, "");
          try {
            console.log("[serverDiscovery] Using cached API base URL:", inMemoryBaseUrl);
          } catch {}
          return inMemoryBaseUrl;
        }
      }
    } catch {}

    // 2) Ordered candidates: configured → host-derived → platform fallbacks
    const candidates: string[] = [];
    const configured = getConfiguredBase();
    if (configured) candidates.push(configured);
    const hostDerived = getHostDerivedCandidate();
    if (hostDerived) candidates.push(hostDerived);
    candidates.push(...getPlatformFallbacks());

    for (const base of candidates) {
      try {
        const ok = await withTimeout(
          (async () => {
            const controller = new AbortController();
            return probeBase(base, controller.signal);
          })(),
          2500
        );
        if (ok) {
          inMemoryBaseUrl = base.replace(/\/+$/, "");
          await SecureStore.setItemAsync(STORAGE_KEY, inMemoryBaseUrl);
          try {
            console.log("[serverDiscovery] Resolved API base URL:", inMemoryBaseUrl);
          } catch {}
          return inMemoryBaseUrl;
        }
      } catch {
        // continue
      }
    }

    // 3) As a last resort on real devices, try a limited LAN scan
    if (Platform.OS === "android" || Platform.OS === "ios") {
      const lanCandidates = generateCommonLanCandidates();
      const found = await probeFirstReachable(lanCandidates, 600, 24);
      if (found) {
        inMemoryBaseUrl = found.replace(/\/+$/, "");
        await SecureStore.setItemAsync(STORAGE_KEY, inMemoryBaseUrl);
        try {
          console.log("[serverDiscovery] Resolved API base URL via LAN scan:", inMemoryBaseUrl);
        } catch {}
        return inMemoryBaseUrl;
      }
    }

    throw new Error("Unable to resolve API base URL. Ensure server is reachable.");
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/* ------------------------------ helpers -------------------------------- */

export function getCachedApiBaseUrl(): string | null {
  return inMemoryBaseUrl;
}

export async function setApiBaseUrl(base: string): Promise<void> {
  inMemoryBaseUrl = base.replace(/\/+$/, "");
  await SecureStore.setItemAsync(STORAGE_KEY, inMemoryBaseUrl);
}
