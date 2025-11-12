<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-primary-600 text-white shadow-lg">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <h1 class="text-2xl font-bold">Claude SDK Agent Chat</h1>
        <p class="text-sm text-primary-100">Powered by Claude Agent SDK with Real-time Streaming</p>
      </div>
    </header>

    <!-- Chat Messages -->
    <MessageList
      :messages="messages"
      :streaming-content="streamingContent"
      :is-streaming="isStreaming"
      :error="error"
    />

    <!-- Input Box -->
    <InputBox
      :is-streaming="isStreaming"
      @send="sendMessage"
      @clear="clearConversation"
    />
  </div>
</template>

<script setup lang="ts">
import { useStreaming } from '../composables/useStreaming';
import MessageList from '../components/MessageList.vue';
import InputBox from '../components/InputBox.vue';

// Generate a simple user ID (in production, this would come from authentication)
const userId = `user-${Math.random().toString(36).substring(7)}`;

const { messages, streamingContent, isStreaming, error, sendMessage, clearConversation } =
  useStreaming(userId);
</script>
