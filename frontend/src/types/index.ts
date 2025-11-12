export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SSEEvent {
  type: 'content_delta' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'message_complete' | 'file_created';
  delta?: string;
  thinking?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  status?: string;
  sessionId?: string;
  message?: Message;
  error?: string;
  // File-related fields
  fileName?: string;
  filePath?: string;
  fileSize?: number;
}

// Activity types for displaying agent actions
export interface AgentActivity {
  type: 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'file_created';
  content: string;
  timestamp: number;
  details?: any;
}

// Artifact file interface
export interface ArtifactFile {
  path: string;
  relativePath: string;
  size: number;
  created: Date;
}
