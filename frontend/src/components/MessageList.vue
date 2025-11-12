<template>
  <div
    ref="messageContainer"
    class="flex-1 overflow-y-auto p-4 space-y-4"
  >
    <div v-if="messages.length === 0" class="text-center text-gray-500 mt-8">
      <h2 class="text-2xl font-bold mb-2">Welcome to Claude Chat</h2>
      <p>Start a conversation by typing a message below</p>
    </div>

    <Message
      v-for="(message, index) in messages"
      :key="index"
      :message="message"
    />

    <StreamingMessage v-if="isStreaming" :content="streamingContent" />

    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      <strong>Error:</strong> {{ error }}
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
