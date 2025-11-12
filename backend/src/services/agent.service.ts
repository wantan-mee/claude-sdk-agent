import { query } from '@anthropic-ai/claude-agent-sdk';

export class ClaudeAgentService {
  /**
   * Process a chat message using Claude Agent SDK
   * The SDK automatically manages conversation history via session IDs
   */
  async processMessage(
    sessionId: string | undefined,
    userMessage: string,
    onStream: (delta: string) => void
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

    // Stream response chunks
    for await (const message of response) {
      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
      }

      // Stream assistant messages
      if (message.type === 'assistant') {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              fullResponse += block.text;
              onStream(block.text);
            }
          }
        }
      }
    }

    return { sessionId: newSessionId, response: fullResponse };
  }
}
