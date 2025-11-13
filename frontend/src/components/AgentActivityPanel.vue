<template>
  <div
    :class="[
      'bg-white flex flex-col overflow-hidden transition-all duration-300 ease-in-out relative',
      isExpanded ? 'w-[400px]' : 'w-12'
    ]"
  >
    <!-- Collapsed State: Icon Button -->
    <button
      v-if="!isExpanded"
      @click="togglePanel"
      class="absolute top-3 left-2 p-2 rounded-lg hover:bg-purple-100 transition-colors group"
      title="Show agent activity"
    >
      <svg class="w-6 h-6 text-purple-600 group-hover:scale-110 transition-transform" :class="{'animate-pulse': isStreaming || currentThinking}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <!-- Activity indicator badge -->
      <div v-if="isStreaming || activities.length > 0" class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
    </button>

    <!-- Expanded State: Full Panel -->
    <template v-if="isExpanded">
      <!-- Panel Header -->
      <div class="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Agent Activity
          </h2>
          <p class="text-xs text-gray-600 mt-1">Real-time agent operations</p>
        </div>
        <!-- Collapse Button -->
        <button
          @click="togglePanel"
          class="p-1.5 rounded-lg hover:bg-purple-200 transition-colors"
          title="Hide panel"
        >
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Panel Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Idle State -->
        <div v-if="!isStreaming && activities.length === 0" class="p-6 text-center text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p class="text-sm">Waiting for agent activity...</p>
          <p class="text-xs mt-2">Activity will appear here when the agent starts working</p>
        </div>

        <!-- Active State -->
        <div v-else class="space-y-4 p-4">
          <!-- Current Status Section -->
          <div v-if="isStreaming && currentStatus" class="bg-blue-50 rounded-lg p-4 border border-blue-200 shadow-sm">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0">
                <div class="animate-spin rounded-full h-6 w-6 border-3 border-blue-500 border-t-transparent"></div>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold text-blue-900 mb-1">Current Status</h3>
                <p class="text-sm text-blue-700">{{ currentStatus }}</p>
              </div>
            </div>
          </div>

          <!-- Deep Reasoning Section - PROMINENT -->
          <div v-if="currentThinking" class="bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-purple-300 shadow-md">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-6 h-6 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 class="text-sm font-bold text-purple-900">🧠 Deep Reasoning</h3>
            </div>
            <div class="bg-white rounded-md p-3 border border-purple-200 max-h-80 overflow-y-auto">
              <pre class="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{{ currentThinking }}</pre>
            </div>
            <div class="mt-2 flex items-center gap-1 text-xs text-purple-700">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <span>Extended thinking with up to 10k tokens</span>
            </div>
          </div>

          <!-- Activity Timeline -->
          <div v-if="activities.length > 0" class="space-y-3">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Activity Timeline</h3>

            <!-- Activity Items -->
            <div
              v-for="(activity, index) in recentActivities"
              :key="index"
              class="relative"
            >
              <!-- Timeline Line -->
              <div
                v-if="index < recentActivities.length - 1"
                class="absolute left-[13px] top-7 w-0.5 h-full bg-gray-200"
              ></div>

              <!-- Activity Card -->
              <div class="flex gap-3">
                <!-- Icon -->
                <div class="flex-shrink-0 relative z-10">
                  <div
                    :class="[
                      'w-7 h-7 rounded-full flex items-center justify-center',
                      getActivityIconClass(activity.type)
                    ]"
                  >
                    <svg class="w-4 h-4" :class="getActivityIconColor(activity.type)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path v-if="activity.type === 'status'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path v-else-if="activity.type === 'thinking'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      <path v-else-if="activity.type === 'tool_use'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path v-else-if="activity.type === 'tool_result'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path v-else-if="activity.type === 'file_created'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-200 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <h4 class="text-xs font-semibold text-gray-700 mb-1">{{ getActivityTypeLabel(activity.type) }}</h4>
                      <p class="text-xs text-gray-600 break-words">{{ activity.content }}</p>
                    </div>
                    <span class="text-xs text-gray-400 whitespace-nowrap">{{ formatTime(activity.timestamp) }}</span>
                  </div>

                  <!-- Expandable Details -->
                  <details v-if="activity.details" class="mt-2">
                    <summary class="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                      View details
                    </summary>
                    <div class="mt-2 bg-white rounded p-2 border border-gray-200">
                      <pre v-if="activity.type === 'tool_use'" class="text-xs text-gray-700 overflow-auto max-h-32 whitespace-pre-wrap">{{ JSON.stringify(activity.details.toolInput, null, 2) }}</pre>
                      <pre v-else-if="activity.type === 'tool_result'" class="text-xs text-gray-700 overflow-auto max-h-32 whitespace-pre-wrap">{{ formatToolResult(activity.details.toolResult) }}</pre>
                      <div v-else-if="activity.type === 'file_created'" class="text-xs space-y-1">
                        <div class="text-gray-600">
                          <span class="font-semibold">Path:</span>
                          <span class="font-mono text-indigo-600">{{ activity.details.filePath }}</span>
                        </div>
                        <div class="text-gray-600">
                          <span class="font-semibold">Size:</span> {{ formatFileSize(activity.details.fileSize) }}
                        </div>
                        <a :href="`/api/artifacts/${activity.details.filePath}`" target="_blank" class="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline mt-2">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open file
                        </a>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AgentActivity } from '../types';

const props = defineProps<{
  isStreaming: boolean;
  currentStatus: string;
  currentThinking: string;
  activities: AgentActivity[];
}>();

// Panel expanded state
const isExpanded = ref(false);

// Auto-expand when deep reasoning starts
watch(() => props.currentThinking, (newValue) => {
  if (newValue && !isExpanded.value) {
    // Panel auto-opens when agent enters deep reasoning
    isExpanded.value = true;
  }
});

// Also auto-expand when streaming starts with activities
watch(() => props.isStreaming, (newValue) => {
  if (newValue && props.activities.length > 0 && !isExpanded.value) {
    isExpanded.value = true;
  }
});

// Toggle panel
const togglePanel = () => {
  isExpanded.value = !isExpanded.value;
};

// Show most recent 20 activities
const recentActivities = computed(() => {
  return props.activities.slice(-20).reverse();
});

const getActivityTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    status: 'Status Update',
    thinking: 'Thinking',
    tool_use: 'Tool Execution',
    tool_result: 'Tool Result',
    file_created: 'File Created',
  };
  return labels[type] || type;
};

const getActivityIconClass = (type: string): string => {
  const classes: Record<string, string> = {
    status: 'bg-blue-100',
    thinking: 'bg-purple-100',
    tool_use: 'bg-green-100',
    tool_result: 'bg-teal-100',
    file_created: 'bg-orange-100',
  };
  return classes[type] || 'bg-gray-100';
};

const getActivityIconColor = (type: string): string => {
  const colors: Record<string, string> = {
    status: 'text-blue-600',
    thinking: 'text-purple-600',
    tool_use: 'text-green-600',
    tool_result: 'text-teal-600',
    file_created: 'text-orange-600',
  };
  return colors[type] || 'text-gray-600';
};

const formatTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;

  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatToolResult = (result: any): string => {
  if (typeof result === 'string') {
    return result;
  }
  return JSON.stringify(result, null, 2);
};

const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
</script>
