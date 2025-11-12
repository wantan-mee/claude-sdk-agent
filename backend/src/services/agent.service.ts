import { query } from '@anthropic-ai/claude-agent-sdk';

// Enhanced streaming callback to handle all event types
export interface StreamEvent {
  type: 'content_delta' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'message_complete';
  delta?: string;
  thinking?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  status?: string;
  sessionId?: string;
  message?: any;
  error?: string;
}

export class ClaudeAgentService {
  /**
   * Process a chat message using Claude Agent SDK
   * The SDK automatically manages conversation history via session IDs
   * Streams ALL events including thoughts, tool use, and status updates
   */
  async processMessage(
    sessionId: string | undefined,
    userMessage: string,
    onStream: (event: StreamEvent) => void
  ): Promise<{ sessionId: string | undefined; response: string }> {
    // Use Claude Agent SDK's built-in session management
    const response = query({
      prompt: userMessage,
      options: {
        resume: sessionId, // SDK loads history automatically
        model: 'claude-sonnet-4-5',
      },
    });

    let newSessionId: string | undefined;
    let fullResponse = '';

    // Stream ALL response events for transparency
    for await (const message of response) {
      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
        onStream({
          type: 'status',
          status: 'Initialized conversation session',
        });
      }

      // Stream status updates
      if (message.type === 'system' && message.subtype === 'status') {
        onStream({
          type: 'status',
          status: (message as any).status || 'Processing...',
        });
      }

      // Stream assistant messages (thoughts, text, tool use)
      if (message.type === 'assistant') {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            // Stream text content
            if (block.type === 'text') {
              fullResponse += block.text;
              onStream({
                type: 'content_delta',
                delta: block.text,
              });
            }
            // Stream tool use
            else if (block.type === 'tool_use') {
              onStream({
                type: 'tool_use',
                toolName: block.name,
                toolInput: block.input,
              });
            }
          }
        }

        // Stream thinking blocks
        if ((message.message as any).thinking) {
          const thinking = (message.message as any).thinking;
          onStream({
            type: 'thinking',
            thinking: typeof thinking === 'string' ? thinking : JSON.stringify(thinking),
          });
        }
      }

      // Stream tool results
      if (message.type === 'result') {
        onStream({
          type: 'tool_result',
          toolName: (message as any).tool_name || 'Tool',
          toolResult: (message as any).result || message,
        });
      }

      // Stream tool progress updates
      if (message.type === 'tool_progress') {
        onStream({
          type: 'status',
          status: `Tool in progress: ${(message as any).message || 'Processing...'}`,
        });
      }
    }

    return { sessionId: newSessionId, response: fullResponse };
  }
}
