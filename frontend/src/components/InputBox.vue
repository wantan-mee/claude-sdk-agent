<template>
  <div class="border-t bg-white p-4">
    <div class="max-w-4xl mx-auto flex gap-2">
      <textarea
        v-model="inputMessage"
        @keydown.enter.exact.prevent="handleSend"
        :disabled="isStreaming"
        placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
        class="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        rows="3"
      />
      <div class="flex flex-col gap-2">
        <button
          @click="handleSend"
          :disabled="!inputMessage.trim() || isStreaming"
          class="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {{ isStreaming ? 'Sending...' : 'Send' }}
        </button>
        <button
          @click="$emit('clear')"
          :disabled="isStreaming"
          class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  send: [message: string];
  clear: [];
}>();

const inputMessage = ref('');

const handleSend = () => {
  const message = inputMessage.value.trim();
  if (message) {
    emit('send', message);
    inputMessage.value = '';
  }
};
</script>
