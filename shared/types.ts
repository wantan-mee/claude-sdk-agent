export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SSEEvent {
  type: 'content_delta' | 'message_complete' | 'error';
  delta?: string;
  sessionId?: string;
  message?: Message;
  error?: string;
}

export interface UserSession {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
}

export interface SessionInfo {
  userId: string;
  sessionId?: string;
  hasSession: boolean;
}
