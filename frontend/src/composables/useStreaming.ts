import { ref, Ref } from 'vue';
import type { Message, SSEEvent, AgentActivity } from '../types';

export function useStreaming(userId: string) {
  const messages: Ref<Message[]> = ref([]);
  const streamingContent = ref('');
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  const sessionId = ref<string | null>(null);

  // Track real-time agent activities for transparency
  const currentStatus = ref<string>('');
  const currentThinking = ref<string>('');
  const activities: Ref<AgentActivity[]> = ref([]);

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
    currentStatus.value = '';
    currentThinking.value = '';
    activities.value = [];

    try {
      const eventSource = new EventSource(
        `/api/chat/stream?userId=${encodeURIComponent(userId)}&message=${encodeURIComponent(content)}`
      );

      eventSource.onmessage = (event) => {
        const data: SSEEvent = JSON.parse(event.data);

        // Handle text content streaming
        if (data.type === 'content_delta' && data.delta) {
          streamingContent.value += data.delta;
        }

        // Handle status updates
        else if (data.type === 'status' && data.status) {
          currentStatus.value = data.status;
          activities.value.push({
            type: 'status',
            content: data.status,
            timestamp: Date.now(),
          });
        }

        // Handle thinking blocks
        else if (data.type === 'thinking' && data.thinking) {
          currentThinking.value = data.thinking;
          activities.value.push({
            type: 'thinking',
            content: data.thinking,
            timestamp: Date.now(),
          });
        }

        // Handle tool use
        else if (data.type === 'tool_use' && data.toolName) {
          const toolUseMsg = `Using tool: ${data.toolName}`;
          currentStatus.value = toolUseMsg;
          activities.value.push({
            type: 'tool_use',
            content: toolUseMsg,
            timestamp: Date.now(),
            details: {
              toolName: data.toolName,
              toolInput: data.toolInput,
            },
          });
        }

        // Handle tool results
        else if (data.type === 'tool_result' && data.toolName) {
          const toolResultMsg = `Tool ${data.toolName} completed`;
          currentStatus.value = toolResultMsg;
          activities.value.push({
            type: 'tool_result',
            content: toolResultMsg,
            timestamp: Date.now(),
            details: {
              toolName: data.toolName,
              toolResult: data.toolResult,
            },
          });
        }

        // Handle file creation
        else if (data.type === 'file_created' && data.fileName) {
          const fileCreatedMsg = `📄 Created file: ${data.fileName}`;
          currentStatus.value = fileCreatedMsg;
          activities.value.push({
            type: 'file_created',
            content: fileCreatedMsg,
            timestamp: Date.now(),
            details: {
              fileName: data.fileName,
              filePath: data.filePath,
              fileSize: data.fileSize,
            },
          });
        }

        // Handle completion
        else if (data.type === 'message_complete') {
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
          currentStatus.value = '';
          currentThinking.value = '';
          eventSource.close();
        }

        // Handle errors
        else if (data.type === 'error') {
          error.value = data.error || 'An error occurred';
          isStreaming.value = false;
          currentStatus.value = '';
          currentThinking.value = '';
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        error.value = 'Connection error';
        isStreaming.value = false;
        currentStatus.value = '';
        currentThinking.value = '';
        eventSource.close();
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      isStreaming.value = false;
      currentStatus.value = '';
      currentThinking.value = '';
    }
  };

  const clearConversation = async () => {
    try {
      await fetch(`/api/session/${userId}`, { method: 'DELETE' });
      messages.value = [];
      sessionId.value = null;
      streamingContent.value = '';
      error.value = null;
      currentStatus.value = '';
      currentThinking.value = '';
      activities.value = [];
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
    currentStatus,
    currentThinking,
    activities,
    sendMessage,
    clearConversation,
  };
}
