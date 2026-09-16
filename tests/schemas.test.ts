import { describe, expect, it } from 'vitest';
import {
  handshakeAuthSchema,
  messageSendSchema,
} from '../src/validation/schemas.js';

describe('handshakeAuthSchema', () => {
  it('accepts display name and optional uuid', () => {
    const r = handshakeAuthSchema.safeParse({ displayName: 'Ali' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.displayName).toBe('Ali');
  });

  it('rejects empty name', () => {
    expect(handshakeAuthSchema.safeParse({ displayName: '   ' }).success).toBe(
      false,
    );
  });
});

describe('messageSendSchema', () => {
  it('accepts valid payload', () => {
    const r = messageSendSchema.safeParse({
      roomId: 'general',
      text: 'Hello',
      clientMsgId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(r.success).toBe(true);
  });

  it('rejects bad room id', () => {
    expect(
      messageSendSchema.safeParse({
        roomId: '../etc',
        text: 'x',
        clientMsgId: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(false);
  });
});
