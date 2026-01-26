// server/src/app.ts
import cors from 'cors';
import express from 'express';
import { config } from './config';

import assistRoutes from './routes/assist';
import authRoutes from './routes/auth';
import conversationsRoutes from './routes/conversations';
import geoRoutes from './routes/geo';
import messagesRoutes from './routes/messages';
import operatorRoutes from './routes/operator';
import ratingsRoutes from './routes/ratings';
import routeRoutes from './routes/route';
import uploadsRoutes from './routes/uploads';

const app = express();

/* ---------- middleware ---------- */
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const corsOrigin = config.clientUrl || true;
const corsOptions: cors.CorsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ---------- root & health (define before routes/404) ---------- */
app.get('/', (_req, res) => res.send('Server is running'));

// Make BOTH work for device discovery and app probes
app.get(['/api/health', '/health'], (_req, res) =>
  res.status(200).json({ success: true, message: 'Server is healthy', ok: true })
);

/* ---------- routes ---------- */
app.use('/api/auth', authRoutes);
app.use('/api/users', operatorRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/assist', assistRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/uploads', uploadsRoutes);

// ORS routing proxy
app.use('/api/route', routeRoutes);
app.use('/api/ratings', ratingsRoutes);

/* ---------- 404 & error (keep LAST) ---------- */
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = Number(err?.status) || 500;
    const msg = err?.message || 'Server error';
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({ message: msg });
  }
);

export default app;
