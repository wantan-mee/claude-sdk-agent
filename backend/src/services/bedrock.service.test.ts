import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BedrockAgentService } from './bedrock.service.js';

// Mock AWS Bedrock SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
    ConverseStreamCommand: vi.fn(),
  };
});

import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

describe('BedrockAgentService', () => {
  let agentService: BedrockAgentService;
  let mockSend: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agentService = new BedrockAgentService();
    mockSend = vi.mocked(BedrockRuntimeClient).mock.results[0]?.value.send;
  });

  describe('processMessage', () => {
    it('should process a message and return response', async () => {
      // Mock streaming response
      const mockStream = (async function* () {
        yield {
          contentBlockDelta: {
            delta: {
              text: 'Hello! ',
            },
          },
        };
        yield {
          contentBlockDelta: {
            delta: {
              text: 'How can I help you?',
            },
          },
        };
      })();

      mockSend.mockResolvedValue({
        stream: mockStream,
      });

      const streamedChunks: string[] = [];
      const onStream = (delta: string) => {
        streamedChunks.push(delta);
      };

      const result = await agentService.processMessage([], 'Hello', onStream);

      expect(result.response).toBe('Hello! How can I help you?');
      expect(streamedChunks).toEqual(['Hello! ', 'How can I help you?']);
      expect(ConverseStreamCommand).toHaveBeenCalled();
    });

    it('should include conversation history in request', async () => {
      const mockStream = (async function* () {
        yield {
          contentBlockDelta: {
            delta: { text: 'Response' },
          },
        };
      })();

      mockSend.mockResolvedValue({
        stream: mockStream,
      });

      const history = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' },
      ];

      await agentService.processMessage(history, 'New question', () => {});

      const commandCall = vi.mocked(ConverseStreamCommand).mock.calls[0][0];
      expect(commandCall.messages).toHaveLength(3); // 2 from history + 1 new
      expect(commandCall.messages[0].role).toBe('user');
      expect(commandCall.messages[1].role).toBe('assistant');
      expect(commandCall.messages[2].role).toBe('user');
    });

    it('should handle empty conversation history', async () => {
      const mockStream = (async function* () {
        yield {
          contentBlockDelta: {
            delta: { text: 'First response' },
          },
        };
      })();

      mockSend.mockResolvedValue({
        stream: mockStream,
      });

      const streamedChunks: string[] = [];
      const result = await agentService.processMessage([], 'First message', (delta) =>
        streamedChunks.push(delta)
      );

      expect(result.response).toBe('First response');
      expect(streamedChunks).toEqual(['First response']);

      const commandCall = vi.mocked(ConverseStreamCommand).mock.calls[0][0];
      expect(commandCall.messages).toHaveLength(1);
    });

    it('should call onStream callback for each text chunk', async () => {
      const mockStream = (async function* () {
        yield { contentBlockDelta: { delta: { text: 'chunk1' } } };
        yield { contentBlockDelta: { delta: { text: 'chunk2' } } };
        yield { contentBlockDelta: { delta: { text: 'chunk3' } } };
      })();

      mockSend.mockResolvedValue({
        stream: mockStream,
      });

      const onStream = vi.fn();
      await agentService.processMessage([], 'Test', onStream);

      expect(onStream).toHaveBeenCalledTimes(3);
      expect(onStream).toHaveBeenNthCalledWith(1, 'chunk1');
      expect(onStream).toHaveBeenNthCalledWith(2, 'chunk2');
      expect(onStream).toHaveBeenNthCalledWith(3, 'chunk3');
    });

    it('should handle non-text content events gracefully', async () => {
      const mockStream = (async function* () {
        yield { contentBlockDelta: { delta: { text: 'Text content' } } };
        yield { someOtherEvent: {} }; // Non-text event
        yield { contentBlockDelta: { delta: { text: ' more text' } } };
      })();

      mockSend.mockResolvedValue({
        stream: mockStream,
      });

      const streamedChunks: string[] = [];
      const result = await agentService.processMessage([], 'Test', (delta) =>
        streamedChunks.push(delta)
      );

      expect(result.response).toBe('Text content more text');
      expect(streamedChunks).toEqual(['Text content', ' more text']);
    });

    it('should handle API errors', async () => {
      mockSend.mockRejectedValue(new Error('Bedrock API error'));

      await expect(agentService.processMessage([], 'Test', () => {})).rejects.toThrow(
        'Bedrock API error'
      );
    });
  });
});
