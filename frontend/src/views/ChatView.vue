<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
      <div class="px-6 py-4">
        <h1 class="text-2xl font-bold">Claude SDK Agent</h1>
        <p class="text-sm text-indigo-100">Deep Reasoning · Real-time Streaming · Full Tool Access</p>
      </div>
    </header>

    <!-- Main Content: Split Screen Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Side: Chat Messages (70%) -->
      <div class="flex flex-col w-[70%] border-r border-gray-200">
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

      <!-- Right Side: Agent Activity Panel (30%) -->
      <AgentActivityPanel
        :is-streaming="isStreaming"
        :current-status="currentStatus"
        :current-thinking="currentThinking"
        :activities="activities"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStreaming } from '../composables/useStreaming';
import MessageList from '../components/MessageList.vue';
import InputBox from '../components/InputBox.vue';
import AgentActivityPanel from '../components/AgentActivityPanel.vue';

// Generate a simple user ID (in production, this would come from authentication)
const userId = `user-${Math.random().toString(36).substring(7)}`;

const {
  messages,
  streamingContent,
  isStreaming,
  error,
  currentStatus,
  currentThinking,
  activities,
  sendMessage,
  clearConversation,
} = useStreaming(userId);
</script>
