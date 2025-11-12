import { ref, Ref } from 'vue';
import type { Message, SSEEvent } from '../types';

export function useStreaming(userId: string) {
  const messages: Ref<Message[]> = ref([]);
  const streamingContent = ref('');
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  const sessionId = ref<string | null>(null);

  const sendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    messages.value.push(userMessage);

    // Reset state
    streamingContent.value = '';
    isStreaming.value = true;
    error.value = null;

    try {
      const eventSource = new EventSource(
        `/api/chat/stream?userId=${encodeURIComponent(userId)}&message=${encodeURIComponent(content)}`
      );

      eventSource.onmessage = (event) => {
        const data: SSEEvent = JSON.parse(event.data);

        if (data.type === 'content_delta' && data.delta) {
          streamingContent.value += data.delta;
        } else if (data.type === 'message_complete') {
          // Add assistant message to history
          const assistantMessage: Message = {
            role: 'assistant',
            content: streamingContent.value,
            timestamp: Date.now(),
          };
          messages.value.push(assistantMessage);

          // Update session ID
          if (data.sessionId) {
            sessionId.value = data.sessionId;
          }

          // Reset streaming state
          streamingContent.value = '';
          isStreaming.value = false;
          eventSource.close();
        } else if (data.type === 'error') {
          error.value = data.error || 'An error occurred';
          isStreaming.value = false;
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        error.value = 'Connection error';
        isStreaming.value = false;
        eventSource.close();
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      isStreaming.value = false;
    }
  };

  const clearConversation = async () => {
    try {
      await fetch(`/api/session/${userId}`, { method: 'DELETE' });
      messages.value = [];
      sessionId.value = null;
      streamingContent.value = '';
      error.value = null;
    } catch (err) {
      error.value = 'Failed to clear conversation';
    }
  };

  return {
    messages,
    streamingContent,
    isStreaming,
    error,
    sessionId,
    sendMessage,
    clearConversation,
  };
}
