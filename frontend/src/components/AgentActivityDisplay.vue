<template>
  <div v-if="isStreaming" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <!-- Current Status -->
    <div v-if="currentStatus" class="flex items-center gap-2 mb-3">
      <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
      <span class="text-sm font-medium text-blue-700">{{ currentStatus }}</span>
    </div>

    <!-- Current Thinking -->
    <div v-if="currentThinking" class="mb-3">
      <details class="bg-white rounded p-3 border border-blue-200">
        <summary class="cursor-pointer text-sm font-medium text-blue-700 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Thinking...
        </summary>
        <pre class="mt-2 text-xs text-gray-700 whitespace-pre-wrap">{{ currentThinking }}</pre>
      </details>
    </div>

    <!-- Activity History (collapsible) -->
    <details v-if="activities.length > 0" class="text-sm">
      <summary class="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
        View Activity History ({{ activities.length }} events)
      </summary>
      <div class="mt-2 space-y-2 max-h-64 overflow-y-auto">
        <div
          v-for="(activity, index) in activities"
          :key="index"
          class="flex items-start gap-2 p-2 bg-white rounded border border-gray-200 text-xs"
        >
          <span class="flex-shrink-0">
            <svg v-if="activity.type === 'status'" class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="activity.type === 'thinking'" class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <svg v-else-if="activity.type === 'tool_use'" class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else-if="activity.type === 'tool_result'" class="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div class="flex-1">
            <div class="font-medium text-gray-700">{{ activity.content }}</div>
            <div v-if="activity.details" class="mt-1 text-gray-500">
              <details v-if="activity.type === 'tool_use'" class="mt-1">
                <summary class="cursor-pointer hover:text-gray-700">View tool input</summary>
                <pre class="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">{{ JSON.stringify(activity.details.toolInput, null, 2) }}</pre>
              </details>
              <details v-else-if="activity.type === 'tool_result'" class="mt-1">
                <summary class="cursor-pointer hover:text-gray-700">View tool result</summary>
                <pre class="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">{{ formatToolResult(activity.details.toolResult) }}</pre>
              </details>
            </div>
          </div>
          <span class="text-gray-400 text-xs flex-shrink-0">
            {{ formatTime(activity.timestamp) }}
          </span>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { AgentActivity } from '../types';

defineProps<{
  isStreaming: boolean;
  currentStatus: string;
  currentThinking: string;
  activities: AgentActivity[];
}>();

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatToolResult = (result: any) => {
  if (typeof result === 'string') {
    return result;
  }
  return JSON.stringify(result, null, 2);
};
</script>
