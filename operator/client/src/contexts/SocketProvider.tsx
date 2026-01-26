import React from 'react';
import { tokens } from '../auth/tokenStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { initNotifications, presentNow } from '../services/notificationService';

type Ctx = {
  socket: ReturnType<typeof getSocket>;
  connected: boolean;
};

export const SocketContext = React.createContext<Ctx>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = React.useState(false);
  const [socketState, setSocketState] = React.useState(getSocket());

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const s = await connectSocket();
      if (cancelled || !s) return;

      setSocketState(s);
      setConnected(s.connected);

      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      const onError = () => setConnected(false);

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      s.on('connect_error', onError);

      // Ask for notification permission once we have a socket (so we can notify instantly)
      try {
        await initNotifications();
      } catch {}

      // 🔔 Zero-delay: show a local notification as soon as a new request is created
      const onAssistCreated = (evt: any) => {
        try {
          const name =
            evt?.clientName || evt?.customerName || evt?.contactName || 'Customer';
          const place =
            evt?.placeName ||
            evt?.address ||
            evt?.location?.name ||
            evt?.location?.address ||
            evt?.vehicle?.model ||
            '';
          const body = place ? `${name} • ${place}` : `${name} sent a request`;

          presentNow({
            title: 'New assistance request',
            body,
            data: { type: 'assist', requestId: String(evt?.id || '') },
          });
        } catch {}
      };

      s.on('assist:created', onAssistCreated);

      return () => {
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
        s.off('connect_error', onError);
        s.off('assist:created', onAssistCreated);
      };
    })();

    return () => {
      cancelled = true;
      disconnectSocket();
    };
    // Reconnect when token changes
  }, [tokens.accessToken]);

  return (
    <SocketContext.Provider value={{ socket: socketState, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
