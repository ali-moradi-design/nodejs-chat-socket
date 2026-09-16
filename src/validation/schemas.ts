import { z } from 'zod';
import { config } from '../config.js';
import {
  sanitizeDisplayName,
  sanitizePlainText,
  sanitizeRoomName,
} from './sanitize.js';

export const handshakeAuthSchema = z.object({
  userId: z.string().uuid().optional(),
  displayName: z
    .string()
    .min(1)
    .max(64)
    .transform(sanitizeDisplayName)
    .refine((v) => v.length >= 1 && v.length <= 32, {
      message: 'Display name must be 1–32 characters',
    }),
});

export const messageSendSchema = z.object({
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid room id'),
  text: z
    .string()
    .min(1)
    .max(config.maxMessageLength + 200)
    .transform((t) => sanitizePlainText(t, config.maxMessageLength))
    .refine((t) => t.length >= 1, { message: 'Message cannot be empty' }),
  clientMsgId: z.string().uuid(),
});

export const historyRequestSchema = z.object({
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  afterId: z.string().uuid().optional(),
  beforeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const roomJoinSchema = z.object({
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

export const roomCreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .transform(sanitizeRoomName)
    .refine((v) => v.length >= 1 && v.length <= 48, {
      message: 'Room name must be 1–48 characters',
    }),
});

export const typingSchema = z.object({
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

export type HandshakeAuth = z.infer<typeof handshakeAuthSchema>;
export type MessageSendInput = z.infer<typeof messageSendSchema>;
