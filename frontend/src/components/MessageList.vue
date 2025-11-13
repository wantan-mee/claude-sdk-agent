<template>
  <div
    ref="messageContainer"
    class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
  >
    <div v-if="messages.length === 0" class="text-center text-gray-500 mt-16">
      <div class="mb-4">
        <svg class="w-20 h-20 mx-auto text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold mb-2 text-gray-700">Welcome to Claude SDK Agent</h2>
      <p class="text-gray-500">Ask me anything. I have access to all tools and deep reasoning capabilities.</p>
    </div>

    <Message
      v-for="(message, index) in messages"
      :key="index"
      :message="message"
    />

    <StreamingMessage v-if="isStreaming" :content="streamingContent" />

    <div v-if="error" class="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r shadow-sm">
      <div class="flex items-start">
        <svg class="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div>
          <strong class="font-semibold">Error:</strong>
          <p class="mt-1">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { Message as MessageType } from '../types';
import Message from './Message.vue';
import StreamingMessage from './StreamingMessage.vue';

const props = defineProps<{
  messages: MessageType[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;
}>();

const messageContainer = ref<HTMLDivElement | null>(null);

// Auto-scroll to bottom when new messages arrive
watch(
  () => [props.messages.length, props.streamingContent],
  async () => {
    await nextTick();
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
    }
  }
);
</script>
