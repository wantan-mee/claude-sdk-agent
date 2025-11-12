export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SSEEvent {
  type: 'content_delta' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'message_complete';
  delta?: string;
  thinking?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  status?: string;
  sessionId?: string;
  message?: Message;
  error?: string;
}

// Activity types for displaying agent actions
export interface AgentActivity {
  type: 'thinking' | 'tool_use' | 'tool_result' | 'status';
  content: string;
  timestamp: number;
  details?: any;
}
