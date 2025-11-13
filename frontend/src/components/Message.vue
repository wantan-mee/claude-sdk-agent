<template>
  <div
    :class="{
      'message-user': message.role === 'user',
      'message-assistant': message.role === 'assistant',
    }"
  >
    <MarkdownRenderer
      v-if="message.role === 'assistant'"
      :content="message.content"
    />
    <div v-else class="whitespace-pre-wrap break-words">{{ message.content }}</div>
    <div class="text-xs opacity-70 mt-1">
      {{ formatTime(message.timestamp) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Message } from '../types';
import MarkdownRenderer from './MarkdownRenderer.vue';

defineProps<{
  message: Message;
}>();

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>
