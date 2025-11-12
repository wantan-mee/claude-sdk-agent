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
