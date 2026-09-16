import { Router } from 'express';
import { z } from 'zod';
import { chatStore } from '../store/chatStore.js';

export const apiRouter = Router();

apiRouter.get('/rooms', (_req, res) => {
  res.json({ rooms: chatStore.listRooms() });
});

apiRouter.get('/rooms/:id/messages', (req, res) => {
  const params = z
    .object({
      before: z.string().uuid().optional(),
      after: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    })
    .safeParse(req.query);

  if (!params.success) {
    res.status(400).json({ error: 'Invalid query', details: params.error.flatten() });
    return;
  }

  const roomId = String(req.params.id);
  if (!chatStore.getRoom(roomId)) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const messages = chatStore.getHistory({
    roomId,
    beforeId: params.data.before,
    afterId: params.data.after,
    limit: params.data.limit,
  });

  res.json({ roomId, messages });
});
