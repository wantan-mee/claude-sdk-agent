<template>
  <div v-if="content" class="message-streaming">
    <div class="whitespace-pre-wrap break-words">{{ content }}</div>
    <div class="text-xs opacity-70 mt-1 flex items-center gap-1">
      <span>Streaming...</span>
      <div class="flex gap-1">
        <span class="animate-bounce delay-0">.</span>
        <span class="animate-bounce delay-100">.</span>
        <span class="animate-bounce delay-200">.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  content: string;
}>();
</script>

<style scoped>
.delay-0 {
  animation-delay: 0ms;
}
.delay-100 {
  animation-delay: 100ms;
}
.delay-200 {
  animation-delay: 200ms;
}
</style>
