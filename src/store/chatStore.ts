import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import type { ChatMessage, ChatRoom, PresenceUser } from '../types.js';
import {
  loadState,
  PersistenceWatcher,
  type PersistedState,
} from './persistence.js';

const DEFAULT_ROOM: ChatRoom = {
  id: 'general',
  name: 'General',
  createdAt: new Date(0).toISOString(),
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || `room-${uuidv4().slice(0, 8)}`;
}

export class ChatStore {
  private rooms = new Map<string, ChatRoom>();
  private messages: ChatMessage[] = [];
  private clientMsgIndex = new Map<string, string>();
  /** roomId → Map<userId, PresenceUser> */
  private presence = new Map<string, Map<string, PresenceUser>>();
  /** socketId → Set<roomId> */
  private socketRooms = new Map<string, Set<string>>();
  /** userId → Set<socketId> (multi-tab) */
  private userSockets = new Map<string, Set<string>>();
  /** socketId → userId */
  private socketUsers = new Map<string, string>();
  /** socketId → displayName */
  private socketNames = new Map<string, string>();

  private persistence: PersistenceWatcher;

  constructor() {
    const loaded = loadState(config.persistencePath);
    for (const room of loaded.rooms) this.rooms.set(room.id, room);
    if (!this.rooms.has(DEFAULT_ROOM.id)) {
      this.rooms.set(DEFAULT_ROOM.id, { ...DEFAULT_ROOM });
    }
    this.messages = loaded.messages;
    for (const [k, v] of Object.entries(loaded.clientMsgIndex)) {
      this.clientMsgIndex.set(k, v);
    }

    this.persistence = new PersistenceWatcher(
      config.persistencePath,
      config.persistenceFlushMs,
      () => this.snapshot(),
    );
    this.persistence.markDirty();
    this.persistence.start();
  }

  private snapshot(): PersistedState {
    return {
      rooms: [...this.rooms.values()],
      messages: this.messages,
      clientMsgIndex: Object.fromEntries(this.clientMsgIndex),
    };
  }

  stop(): void {
    this.persistence.stop();
  }

  listRooms(): ChatRoom[] {
    return [...this.rooms.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  getRoom(roomId: string): ChatRoom | undefined {
    return this.rooms.get(roomId);
  }

  ensureRoom(roomId: string, name?: string): ChatRoom {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;
    const room: ChatRoom = {
      id: roomId,
      name: name ?? roomId,
      createdAt: new Date().toISOString(),
    };
    this.rooms.set(roomId, room);
    this.persistence.markDirty();
    return room;
  }

  createRoom(name: string): ChatRoom {
    let id = slugify(name);
    if (this.rooms.has(id)) {
      id = `${id}-${uuidv4().slice(0, 6)}`;
    }
    return this.ensureRoom(id, name);
  }

  registerSocket(socketId: string, userId: string, displayName: string): void {
    this.socketUsers.set(socketId, userId);
    this.socketNames.set(socketId, displayName);
    let set = this.userSockets.get(userId);
    if (!set) {
      set = new Set();
      this.userSockets.set(userId, set);
    }
    set.add(socketId);
    if (!this.socketRooms.has(socketId)) {
      this.socketRooms.set(socketId, new Set());
    }
  }

  unregisterSocket(socketId: string): string[] {
    const userId = this.socketUsers.get(socketId);
    const rooms = [...(this.socketRooms.get(socketId) ?? [])];
    this.socketRooms.delete(socketId);
    this.socketUsers.delete(socketId);
    this.socketNames.delete(socketId);

    if (userId) {
      const set = this.userSockets.get(userId);
      if (set) {
        set.delete(socketId);
        if (set.size === 0) this.userSockets.delete(userId);
      }
      // Remove presence only if no sockets left for this user
      const stillOnline = (this.userSockets.get(userId)?.size ?? 0) > 0;
      if (!stillOnline) {
        for (const roomId of rooms) {
          this.presence.get(roomId)?.delete(userId);
        }
      } else {
        // Still online via another tab — just leave this socket's rooms tracking
        for (const roomId of rooms) {
          // keep presence
        }
      }
    }
    return rooms;
  }

  getUserId(socketId: string): string | undefined {
    return this.socketUsers.get(socketId);
  }

  getDisplayName(socketId: string): string | undefined {
    return this.socketNames.get(socketId);
  }

  joinRoom(socketId: string, roomId: string): PresenceUser[] {
    this.ensureRoom(roomId);
    const userId = this.socketUsers.get(socketId);
    const displayName = this.socketNames.get(socketId);
    if (!userId || !displayName) return [];

    let rooms = this.socketRooms.get(socketId);
    if (!rooms) {
      rooms = new Set();
      this.socketRooms.set(socketId, rooms);
    }
    rooms.add(roomId);

    let roomPresence = this.presence.get(roomId);
    if (!roomPresence) {
      roomPresence = new Map();
      this.presence.set(roomId, roomPresence);
    }
    roomPresence.set(userId, { id: userId, displayName });
    return [...roomPresence.values()];
  }

  leaveRoom(socketId: string, roomId: string): PresenceUser[] {
    this.socketRooms.get(socketId)?.delete(roomId);
    const userId = this.socketUsers.get(socketId);
    if (!userId) return this.getPresence(roomId);

    // If user still has another socket in this room, keep presence
    const otherSockets = this.userSockets.get(userId);
    let stillInRoom = false;
    if (otherSockets) {
      for (const sid of otherSockets) {
        if (sid !== socketId && this.socketRooms.get(sid)?.has(roomId)) {
          stillInRoom = true;
          break;
        }
      }
    }
    if (!stillInRoom) {
      this.presence.get(roomId)?.delete(userId);
    }
    return this.getPresence(roomId);
  }

  getPresence(roomId: string): PresenceUser[] {
    return [...(this.presence.get(roomId)?.values() ?? [])];
  }

  getSocketRooms(socketId: string): string[] {
    return [...(this.socketRooms.get(socketId) ?? [])];
  }

  /**
   * Idempotent message insert. Returns existing message if clientMsgId seen.
   */
  addMessage(input: {
    roomId: string;
    userId: string;
    displayName: string;
    text: string;
    clientMsgId: string;
  }): { message: ChatMessage; duplicate: boolean } {
    const existingId = this.clientMsgIndex.get(input.clientMsgId);
    if (existingId) {
      const existing = this.messages.find((m) => m.id === existingId);
      if (existing) return { message: existing, duplicate: true };
    }

    this.ensureRoom(input.roomId);
    const message: ChatMessage = {
      id: uuidv4(),
      clientMsgId: input.clientMsgId,
      roomId: input.roomId,
      userId: input.userId,
      displayName: input.displayName,
      text: input.text,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(message);
    this.clientMsgIndex.set(input.clientMsgId, message.id);
    this.persistence.markDirty();
    return { message, duplicate: false };
  }

  getHistory(opts: {
    roomId: string;
    afterId?: string;
    beforeId?: string;
    limit?: number;
  }): ChatMessage[] {
    const limit = opts.limit ?? 50;
    let list = this.messages.filter((m) => m.roomId === opts.roomId);

    if (opts.afterId) {
      const idx = list.findIndex((m) => m.id === opts.afterId);
      list = idx >= 0 ? list.slice(idx + 1) : list;
      return list.slice(0, limit);
    }

    if (opts.beforeId) {
      const idx = list.findIndex((m) => m.id === opts.beforeId);
      list = idx >= 0 ? list.slice(0, idx) : list;
      return list.slice(-limit);
    }

    return list.slice(-limit);
  }
}

export const chatStore = new ChatStore();
