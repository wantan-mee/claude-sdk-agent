import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: (name: string, description: string, schema: any, handler: any) => ({
    name,
    description,
    schema,
    handler
  }),
  createSdkMcpServer: (config: any) => config
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeAgentService, StreamEvent } from './agent.service.js';

describe('ClaudeAgentService', () => {
  let agentService: ClaudeAgentService;

  beforeEach(() => {
    agentService = new ClaudeAgentService();
    vi.clearAllMocks();
  });

  describe('processMessage', () => {
    it('should process a message and return session ID and response', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session-123',
        },
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'text',
                text: 'Hello! How can I help you today?',
              },
            ],
          },
        },
      ];

      // Mock async generator
      vi.mocked(query).mockReturnValue(
        (async function* () {
          for (const msg of mockMessages) {
            yield msg;
          }
        })() as any
      );

      const streamedChunks: string[] = [];
      const onStream = (event: StreamEvent) => {
        if (event.type === 'content_delta' && event.delta) {
          streamedChunks.push(event.delta);
        }
      };

      const result = await agentService.processMessage(undefined, 'Hello', onStream);

      expect(result.sessionId).toBe('test-session-123');
      expect(result.response).toBe('Hello! How can I help you today?');
      expect(streamedChunks).toEqual(['Hello! How can I help you today?']);
    });

    it('should resume with existing session ID', async () => {
      const existingSessionId = 'existing-session-456';

      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: existingSessionId,
        },
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'text',
                text: 'Continuing our conversation...',
              },
            ],
          },
        },
      ];

      vi.mocked(query).mockReturnValue(
        (async function* () {
          for (const msg of mockMessages) {
            yield msg;
          }
        })() as any
      );

      const streamedChunks: string[] = [];
      const result = await agentService.processMessage(
        existingSessionId,
        'Continue',
        (event) => {
          if (event.type === 'content_delta' && event.delta) {
            streamedChunks.push(event.delta);
          }
        }
      );

      expect(query).toHaveBeenCalledWith({
        prompt: 'Continue',
        options: {
          resume: existingSessionId,
          model: 'claude-sonnet-4-5',
          cwd: expect.any(String),
          maxThinkingTokens: 10000,
          permissionMode: 'bypassPermissions',
          systemPrompt: expect.objectContaining({
            type: 'preset',
            preset: 'claude_code',
            append: expect.any(String),
          }),
        },
      });

      expect(result.sessionId).toBe(existingSessionId);
    });

    it('should handle multiple text blocks in response', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session',
        },
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'text',
                text: 'First chunk ',
              },
              {
                type: 'text',
                text: 'second chunk ',
              },
              {
                type: 'text',
                text: 'third chunk',
              },
            ],
          },
        },
      ];

      vi.mocked(query).mockReturnValue(
        (async function* () {
          for (const msg of mockMessages) {
            yield msg;
          }
        })() as any
      );

      const streamedChunks: string[] = [];
      const result = await agentService.processMessage(undefined, 'Test', (event) => {
        if (event.type === 'content_delta' && event.delta) {
          streamedChunks.push(event.delta);
        }
      });

      expect(result.response).toBe('First chunk second chunk third chunk');
      expect(streamedChunks).toEqual(['First chunk ', 'second chunk ', 'third chunk']);
    });

    it('should handle streaming with multiple messages', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session',
        },
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Part 1 ' }],
          },
        },
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Part 2' }],
          },
        },
      ];

      vi.mocked(query).mockReturnValue(
        (async function* () {
          for (const msg of mockMessages) {
            yield msg;
          }
        })() as any
      );

      const streamedChunks: string[] = [];
      const result = await agentService.processMessage(undefined, 'Test', (event) => {
        if (event.type === 'content_delta' && event.delta) {
          streamedChunks.push(event.delta);
        }
      });

      expect(result.response).toBe('Part 1 Part 2');
      expect(streamedChunks).toEqual(['Part 1 ', 'Part 2']);
    });

    it('should call onStream callback for each text chunk', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session',
        },
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'chunk1' }],
          },
        },
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'chunk2' }],
          },
        },
      ];

      vi.mocked(query).mockReturnValue(
        (async function* () {
          for (const msg of mockMessages) {
            yield msg;
          }
        })() as any
      );

      const onStream = vi.fn();
      await agentService.processMessage(undefined, 'Test', onStream);

      // Verify that onStream was called multiple times (exact count may vary due to status updates)
      expect(onStream).toHaveBeenCalled();

      // Verify content deltas were streamed
      const contentDeltaCalls = onStream.mock.calls.filter(call =>
        call[0].type === 'content_delta'
      );
      expect(contentDeltaCalls.length).toBe(2);
      expect(contentDeltaCalls[0][0].delta).toBe('chunk1');
      expect(contentDeltaCalls[1][0].delta).toBe('chunk2');
    });

    it('should handle non-text content blocks gracefully', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'test-session',
        },
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Text content' },
              { type: 'tool_use', id: 'tool1', name: 'calculator' }, // Non-text block
              { type: 'text', text: ' more text' },
            ],
          },
        },
      ];

      vi.mocked(query).mockReturnValue(
        (async function* () {
          for (const msg of mockMessages) {
            yield msg;
          }
        })() as any
      );

      const streamedChunks: string[] = [];
      const result = await agentService.processMessage(undefined, 'Test', (event) => {
        if (event.type === 'content_delta' && event.delta) {
          streamedChunks.push(event.delta);
        }
      });

      expect(result.response).toBe('Text content more text');
      expect(streamedChunks).toEqual(['Text content', ' more text']);
    });
  });
});
