import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ChatMessage, ChatRoom } from '../types.js';

export interface PersistedState {
  rooms: ChatRoom[];
  messages: ChatMessage[];
  clientMsgIndex: Record<string, string>;
}

const EMPTY: PersistedState = {
  rooms: [],
  messages: [],
  clientMsgIndex: {},
};

export function loadState(path: string): PersistedState {
  try {
    if (!existsSync(path)) return structuredClone(EMPTY);
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as PersistedState;
    return {
      rooms: Array.isArray(data.rooms) ? data.rooms : [],
      messages: Array.isArray(data.messages) ? data.messages : [],
      clientMsgIndex:
        data.clientMsgIndex && typeof data.clientMsgIndex === 'object'
          ? data.clientMsgIndex
          : {},
    };
  } catch (err) {
    console.warn('[persistence] failed to load, starting empty:', err);
    return structuredClone(EMPTY);
  }
}

export function saveState(path: string, state: PersistedState): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state), 'utf8');
  renameSync(tmp, path);
}

export class PersistenceWatcher {
  private dirty = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly path: string,
    private readonly flushMs: number,
    private readonly getState: () => PersistedState,
  ) {}

  markDirty(): void {
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    try {
      saveState(this.path, this.getState());
      this.dirty = false;
    } catch (err) {
      console.error('[persistence] flush failed:', err);
    }
  }

  start(): void {
    this.timer = setInterval(() => this.flush(), this.flushMs);
    if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.flush();
  }
}
