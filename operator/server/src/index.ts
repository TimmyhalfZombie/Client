// server/src/index.ts
import http from 'http';
import app from './app';
import { connectDB } from './db/connect';
import { initSocket } from './socket';
import { initAssistRequestWatcher } from './watchers/assistNewRequestWatcher';

// ---------- Root & Health endpoints (so phone/emulator can verify) ----------
app.get('/', (_req, res) => {
  res.send('Server is running');
});

app.get(['/api/health', '/health'], (_req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

// Optional: JSON 404 fallback so wrong paths are obvious
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// ---------- HTTP + Socket.IO ----------
const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);

// Initialize socket first (binds to server)
initSocket(server);

// ---------- Start ----------
(async () => {
  try {
    await connectDB(); // ✅ Ensure DB is ready first

    // Start change-stream watcher AFTER DB is connected
    try {
      await initAssistRequestWatcher();
    } catch (e: any) {
      // Don’t crash if change streams aren’t available (e.g., standalone Mongo)
      console.warn('[assist watcher] disabled:', e?.message || e);
    }

    server.listen(port, '0.0.0.0', () =>
      console.log(`API listening on 0.0.0.0:${port}`)
    );
  } catch (err) {
    console.error(
      'Failed to connect to MongoDB. Check MONGODB_URI and network.',
      err
    );
    process.exit(1);
  }
})();

// ---------- Graceful shutdown ----------
function shutdown(label: string) {
  console.log(`${label} signal received: closing HTTP server`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Optional: log & exit on unexpected errors (keeps process from hanging)
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
