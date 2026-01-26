// client/src/lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { tokens } from '../auth/tokenStore';
import { resolveApiBaseUrl } from './serverDiscovery';

let socket: Socket | null = null;
let currentUrl: string | null = null;
let connectInFlight: Promise<Socket> | null = null;

function waitForConnect(s: Socket, ms = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (s.connected) return resolve();
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('connect_timeout'));
    }, ms);

    const onConnect = () => { cleanup(); resolve(); };
    const onError = (err: any) => { cleanup(); reject(err instanceof Error ? err : new Error(String(err?.message || err))); };

    const cleanup = () => {
      clearTimeout(timer);
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      s.off('error', onError);
    };

    s.once('connect', onConnect);
    s.once('connect_error', onError);
    s.once('error', onError);
  });
}

export async function connectSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  if (connectInFlight) return connectInFlight;

  connectInFlight = (async () => {
    // Ensure tokens are loaded
    try {
      if ((tokens as any).waitUntilReady) {
        await (tokens as any).waitUntilReady();
      } else if ((tokens as any).loadFromStorage) {
        await (tokens as any).loadFromStorage();
      }
    } catch {}

    const token =
      (typeof (tokens as any).getAccessAsync === 'function'
        ? await (tokens as any).getAccessAsync()
        : (tokens as any).getAccess?.()) || null;

    if (!token) {
      connectInFlight = null;
      throw new Error('no_token');
    }

    const url = await resolveApiBaseUrl();

    // Reuse if same URL and still alive
    if (socket && socket.connected && currentUrl === url) return socket;

    try {
      socket?.removeAllListeners();
      socket?.disconnect();
    } catch {}

    currentUrl = url;
    socket = io(url, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token }, // server expects { token }
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });

    // helpful diagnostics
    socket.on('connect', () => console.log('[socket] connected', socket?.id));
    socket.on('disconnect', (reason) => console.log('[socket] disconnected:', reason));
    socket.on('connect_error', (err) => console.warn('[socket] connect_error:', err?.message || err));
    socket.on('error', (err) => console.warn('[socket] error:', err));

    await waitForConnect(socket, 7000);
    const s = socket;
    connectInFlight = null;
    return s!;
  })();

  try {
    return await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}

export const getSocket = () => socket;

export const disconnectSocket = () => {
  try {
    socket?.removeAllListeners();
    socket?.disconnect();
  } finally {
    socket = null;
    currentUrl = null;
  }
};

/** Emit with Socket.IO ack & timeout. Ensures connection first. */
export async function emitWithAck<T = any>(
  event: string,
  payload?: any,
  timeoutMs = 8000
): Promise<T> {
  const s = await connectSocket();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, timeoutMs);

    try {
      // Ack signature: server must call the provided callback with a payload
      s.timeout(timeoutMs).emit(event, payload, (res: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(res as T);
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    }
  });
}
