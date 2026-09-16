import type { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { SocketRateLimiter } from '../middleware/rateLimit.js';
import { chatStore } from '../store/chatStore.js';
import {
  handshakeAuthSchema,
  historyRequestSchema,
  messageSendSchema,
  roomCreateSchema,
  roomJoinSchema,
  typingSchema,
} from '../validation/schemas.js';

const messageLimiter = new SocketRateLimiter(config.rateLimitPerSec);

function emitError(socket: Socket, error: string, details?: unknown): void {
  socket.emit('error', { error, details });
}

function broadcastPresence(io: Server, roomId: string): void {
  io.to(roomId).emit('presence:update', {
    roomId,
    users: chatStore.getPresence(roomId),
  });
}

export function registerSocketHandlers(io: Server, socket: Socket): void {
  const authRaw = socket.handshake.auth ?? {};
  const parsed = handshakeAuthSchema.safeParse(authRaw);
  if (!parsed.success) {
    emitError(socket, 'Invalid auth handshake', parsed.error.flatten());
    socket.disconnect(true);
    return;
  }

  const userId = parsed.data.userId ?? uuidv4();
  const displayName = parsed.data.displayName;
  chatStore.registerSocket(socket.id, userId, displayName);

  socket.emit('auth:ok', { userId, displayName });

  // Auto-join general on connect
  const generalPresence = chatStore.joinRoom(socket.id, 'general');
  void socket.join('general');
  socket.emit('room:joined', {
    room: chatStore.getRoom('general'),
    users: generalPresence,
  });
  broadcastPresence(io, 'general');

  socket.emit('room:list', { rooms: chatStore.listRooms() });

  socket.on('room:list', () => {
    socket.emit('room:list', { rooms: chatStore.listRooms() });
  });

  socket.on('room:create', (payload, ack?: (res: unknown) => void) => {
    const result = roomCreateSchema.safeParse(payload);
    if (!result.success) {
      const err = { ok: false as const, error: 'Invalid room name' };
      ack?.(err);
      emitError(socket, 'Invalid room name', result.error.flatten());
      return;
    }
    const room = chatStore.createRoom(result.data.name);
    io.emit('room:list', { rooms: chatStore.listRooms() });
    ack?.({ ok: true, room });
  });

  socket.on('room:join', (payload, ack?: (res: unknown) => void) => {
    const result = roomJoinSchema.safeParse(payload);
    if (!result.success) {
      ack?.({ ok: false, error: 'Invalid room id' });
      emitError(socket, 'Invalid room id', result.error.flatten());
      return;
    }
    const { roomId } = result.data;
    const users = chatStore.joinRoom(socket.id, roomId);
    void socket.join(roomId);
    const room = chatStore.getRoom(roomId);
    socket.emit('room:joined', { room, users });
    broadcastPresence(io, roomId);
    ack?.({ ok: true, room, users });
  });

  socket.on('room:leave', (payload, ack?: (res: unknown) => void) => {
    const result = roomJoinSchema.safeParse(payload);
    if (!result.success) {
      ack?.({ ok: false, error: 'Invalid room id' });
      return;
    }
    const { roomId } = result.data;
    if (roomId === 'general') {
      ack?.({ ok: false, error: 'Cannot leave general' });
      return;
    }
    void socket.leave(roomId);
    const users = chatStore.leaveRoom(socket.id, roomId);
    broadcastPresence(io, roomId);
    socket.emit('room:left', { roomId });
    ack?.({ ok: true, roomId, users });
  });

  socket.on('message:history', (payload, ack?: (res: unknown) => void) => {
    const result = historyRequestSchema.safeParse(payload);
    if (!result.success) {
      ack?.({ ok: false, error: 'Invalid history request' });
      emitError(socket, 'Invalid history request', result.error.flatten());
      return;
    }
    const messages = chatStore.getHistory(result.data);
    const response = {
      ok: true as const,
      roomId: result.data.roomId,
      messages,
      afterId: result.data.afterId,
      beforeId: result.data.beforeId,
    };
    socket.emit('message:history', response);
    ack?.(response);
  });

  socket.on('message:send', (payload, ack?: (res: unknown) => void) => {
    if (!messageLimiter.tryConsume(socket.id)) {
      const err = {
        ok: false as const,
        clientMsgId: (payload as { clientMsgId?: string })?.clientMsgId,
        error: 'Rate limit exceeded',
      };
      ack?.(err);
      emitError(socket, 'Rate limit exceeded');
      return;
    }

    const result = messageSendSchema.safeParse(payload);
    if (!result.success) {
      const err = {
        ok: false as const,
        clientMsgId: (payload as { clientMsgId?: string })?.clientMsgId,
        error: 'Invalid message',
        details: result.error.flatten(),
      };
      ack?.(err);
      emitError(socket, 'Invalid message', result.error.flatten());
      return;
    }

    const uid = chatStore.getUserId(socket.id);
    const name = chatStore.getDisplayName(socket.id);
    if (!uid || !name) {
      const err = {
        ok: false as const,
        clientMsgId: result.data.clientMsgId,
        error: 'Not authenticated',
      };
      ack?.(err);
      return;
    }

    // Must be in the room (or auto-join)
    if (!chatStore.getSocketRooms(socket.id).includes(result.data.roomId)) {
      chatStore.joinRoom(socket.id, result.data.roomId);
      void socket.join(result.data.roomId);
    }

    const { message, duplicate } = chatStore.addMessage({
      roomId: result.data.roomId,
      userId: uid,
      displayName: name,
      text: result.data.text,
      clientMsgId: result.data.clientMsgId,
    });

    const ackPayload = {
      ok: true as const,
      id: message.id,
      clientMsgId: message.clientMsgId,
      createdAt: message.createdAt,
      duplicate,
    };
    ack?.(ackPayload);

    if (!duplicate) {
      io.to(message.roomId).emit('message:new', { message });
    }
  });

  socket.on('typing:start', (payload) => {
    const result = typingSchema.safeParse(payload);
    if (!result.success) return;
    const uid = chatStore.getUserId(socket.id);
    const name = chatStore.getDisplayName(socket.id);
    if (!uid || !name) return;
    socket.to(result.data.roomId).emit('typing:start', {
      roomId: result.data.roomId,
      userId: uid,
      displayName: name,
    });
  });

  socket.on('typing:stop', (payload) => {
    const result = typingSchema.safeParse(payload);
    if (!result.success) return;
    const uid = chatStore.getUserId(socket.id);
    const name = chatStore.getDisplayName(socket.id);
    if (!uid || !name) return;
    socket.to(result.data.roomId).emit('typing:stop', {
      roomId: result.data.roomId,
      userId: uid,
      displayName: name,
    });
  });

  socket.on('disconnect', () => {
    messageLimiter.remove(socket.id);
    const rooms = chatStore.unregisterSocket(socket.id);
    for (const roomId of rooms) {
      broadcastPresence(io, roomId);
    }
  });
}
