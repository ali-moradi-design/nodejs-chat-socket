import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'nodejs-chat-socket',
    ts: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
