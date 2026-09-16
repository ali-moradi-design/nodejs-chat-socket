export interface ChatUser {
  id: string;
  displayName: string;
  socketId: string;
}

export interface ChatMessage {
  id: string;
  clientMsgId: string;
  roomId: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  createdAt: string;
}

export interface PresenceUser {
  id: string;
  displayName: string;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface MessageSendPayload {
  roomId: string;
  text: string;
  clientMsgId: string;
}

export interface MessageAck {
  ok: true;
  id: string;
  clientMsgId: string;
  createdAt: string;
}

export interface MessageAckError {
  ok: false;
  clientMsgId?: string;
  error: string;
}

export interface HistoryRequest {
  roomId: string;
  afterId?: string;
  beforeId?: string;
  limit?: number;
}

export interface RoomJoinPayload {
  roomId: string;
}

export interface RoomCreatePayload {
  name: string;
}
