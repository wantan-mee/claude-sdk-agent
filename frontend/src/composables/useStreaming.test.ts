import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStreaming } from './useStreaming';
import { nextTick } from 'vue';

// Mock EventSource
class MockEventSource {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
}

global.EventSource = MockEventSource as any;

// Mock fetch for clearConversation
global.fetch = vi.fn();

describe('useStreaming', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    MockEventSource.reset();
  });

  it('should initialize with empty state', () => {
    const { messages, streamingContent, isStreaming, error, sessionId } = useStreaming('user-123');

    expect(messages.value).toEqual([]);
    expect(streamingContent.value).toBe('');
    expect(isStreaming.value).toBe(false);
    expect(error.value).toBeNull();
    expect(sessionId.value).toBeNull();
  });

  it('should add user message immediately when sending', async () => {
    const { messages, sendMessage } = useStreaming('user-123');

    await sendMessage('Hello');
    await nextTick();

    expect(messages.value).toHaveLength(1);
    expect(messages.value[0].role).toBe('user');
    expect(messages.value[0].content).toBe('Hello');
    expect(messages.value[0].timestamp).toBeDefined();
  });

  it('should set isStreaming to true when sending message', async () => {
    const { isStreaming, sendMessage } = useStreaming('user-123');

    await sendMessage('Hello');
    await nextTick();

    expect(isStreaming.value).toBe(true);
  });

  it('should create EventSource with correct URL', async () => {
    const { sendMessage } = useStreaming('user-123');

    await sendMessage('Hello world');
    await nextTick();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(
      '/api/chat/stream?userId=user-123&message=Hello%20world'
    );
  });

  it('should handle content_delta events', async () => {
    const { sendMessage, streamingContent } = useStreaming('user-123');

    await sendMessage('Test');
    await nextTick();

    const eventSource = MockEventSource.instances[0];

    // Simulate streaming deltas
    eventSource.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'content_delta', delta: 'Hello' }),
      })
    );
    await nextTick();

    expect(streamingContent.value).toBe('Hello');

    eventSource.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'content_delta', delta: ' world' }),
      })
    );
    await nextTick();

    expect(streamingContent.value).toBe('Hello world');
  });

  it('should handle message_complete event', async () => {
    const { sendMessage, messages, streamingContent, isStreaming, sessionId } =
      useStreaming('user-123');

    await sendMessage('Test');
    await nextTick();

    const eventSource = MockEventSource.instances[0];

    // Stream some content
    eventSource.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'content_delta', delta: 'Response text' }),
      })
    );
    await nextTick();

    // Complete the message
    eventSource.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'message_complete',
          sessionId: 'session-123',
        }),
      })
    );
    await nextTick();

    expect(messages.value).toHaveLength(2); // user + assistant
    expect(messages.value[1].role).toBe('assistant');
    expect(messages.value[1].content).toBe('Response text');
    expect(streamingContent.value).toBe('');
    expect(isStreaming.value).toBe(false);
    expect(sessionId.value).toBe('session-123');
  });

  it('should handle error events', async () => {
    const { sendMessage, error, isStreaming } = useStreaming('user-123');

    await sendMessage('Test');
    await nextTick();

    const eventSource = MockEventSource.instances[0];

    eventSource.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'error', error: 'API error occurred' }),
      })
    );
    await nextTick();

    expect(error.value).toBe('API error occurred');
    expect(isStreaming.value).toBe(false);
  });

  it('should handle connection errors', async () => {
    const { sendMessage, error, isStreaming } = useStreaming('user-123');

    await sendMessage('Test');
    await nextTick();

    const eventSource = MockEventSource.instances[0];

    eventSource.onerror?.(new Event('error'));
    await nextTick();

    expect(error.value).toBe('Connection error');
    expect(isStreaming.value).toBe(false);
  });

  it('should clear conversation', async () => {
    const { messages, sessionId, sendMessage, clearConversation } = useStreaming('user-123');

    // Send a message first
    await sendMessage('Test');
    await nextTick();

    const eventSource = MockEventSource.instances[0];
    eventSource.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'content_delta', delta: 'Response' }),
      })
    );
    eventSource.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'message_complete', sessionId: 'session-123' }),
      })
    );
    await nextTick();

    expect(messages.value.length).toBeGreaterThan(0);
    expect(sessionId.value).toBe('session-123');

    // Mock successful DELETE request
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 200 }));

    // Clear conversation
    await clearConversation();
    await nextTick();

    expect(messages.value).toEqual([]);
    expect(sessionId.value).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/session/user-123', { method: 'DELETE' });
  });

  it('should reset streaming content when sending new message', async () => {
    const { sendMessage, streamingContent } = useStreaming('user-123');

    await sendMessage('First');
    await nextTick();

    const eventSource1 = MockEventSource.instances[0];
    eventSource1.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'content_delta', delta: 'First response' }),
      })
    );
    await nextTick();

    expect(streamingContent.value).toBe('First response');

    // Send another message
    await sendMessage('Second');
    await nextTick();

    expect(streamingContent.value).toBe(''); // Should be reset
  });

  it('should handle special characters in messages', async () => {
    const { sendMessage } = useStreaming('user-123');

    await sendMessage('Hello & goodbye <test>');
    await nextTick();

    expect(MockEventSource.instances[0].url).toContain(
      encodeURIComponent('Hello & goodbye <test>')
    );
  });
});
