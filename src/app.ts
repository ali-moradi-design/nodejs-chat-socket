import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';
import { healthRouter } from './routes/health.js';
import { registerSocketHandlers } from './socket/handlers.js';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (config.corsOrigins.includes(origin)) return cb(null, true);
        if (!config.isProd && config.corsOrigins.includes('*')) {
          return cb(null, true);
        }
        return cb(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '32kb' }));

  app.use(healthRouter);
  app.use('/api', apiRouter);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err.message.startsWith('CORS blocked')) {
        res.status(403).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    },
  );

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
    pingInterval: 20000,
    pingTimeout: 15000,
    maxHttpBufferSize: 1e5,
  });

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
  });

  return { app, httpServer, io };
}
