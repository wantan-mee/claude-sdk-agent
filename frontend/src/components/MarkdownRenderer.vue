<template>
  <div class="markdown-content" v-html="renderedMarkdown"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

const props = defineProps<{
  content: string;
}>();

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.warn('Highlight.js error:', err);
      }
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
});

// Render and sanitize markdown
const renderedMarkdown = computed(() => {
  if (!props.content) return '';

  try {
    // Parse markdown to HTML
    const html = marked.parse(props.content) as string;

    // Sanitize HTML to prevent XSS attacks
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
        'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3',
        'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th',
        'td', 'hr', 'img', 'div', 'span',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'title'],
    });

    return sanitized;
  } catch (err) {
    console.error('Markdown rendering error:', err);
    return props.content; // Fallback to plain text
  }
});
</script>

<style scoped>
/* Markdown content styles */
.markdown-content {
  @apply text-base leading-relaxed;
}

/* Headings */
.markdown-content :deep(h1) {
  @apply text-2xl font-bold mt-6 mb-4;
}

.markdown-content :deep(h2) {
  @apply text-xl font-bold mt-5 mb-3;
}

.markdown-content :deep(h3) {
  @apply text-lg font-bold mt-4 mb-2;
}

.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  @apply font-bold mt-3 mb-2;
}

/* Paragraphs */
.markdown-content :deep(p) {
  @apply mb-4;
}

.markdown-content :deep(p:last-child) {
  @apply mb-0;
}

/* Lists */
.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  @apply mb-4 pl-6;
}

.markdown-content :deep(ul) {
  @apply list-disc;
}

.markdown-content :deep(ol) {
  @apply list-decimal;
}

.markdown-content :deep(li) {
  @apply mb-1;
}

/* Code blocks */
.markdown-content :deep(pre) {
  @apply bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4 overflow-x-auto;
}

.markdown-content :deep(pre code) {
  @apply bg-transparent p-0 text-sm font-mono;
}

/* Inline code */
.markdown-content :deep(code) {
  @apply bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono;
}

/* Links */
.markdown-content :deep(a) {
  @apply text-blue-600 dark:text-blue-400 hover:underline;
}

/* Blockquotes */
.markdown-content :deep(blockquote) {
  @apply border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 mb-4 italic;
}

/* Tables */
.markdown-content :deep(table) {
  @apply w-full mb-4 border-collapse;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  @apply border border-gray-300 dark:border-gray-600 px-4 py-2;
}

.markdown-content :deep(th) {
  @apply bg-gray-100 dark:bg-gray-800 font-bold;
}

/* Horizontal rule */
.markdown-content :deep(hr) {
  @apply my-6 border-t border-gray-300 dark:border-gray-600;
}

/* Images */
.markdown-content :deep(img) {
  @apply max-w-full h-auto rounded-lg my-4;
}

/* Strong/Bold */
.markdown-content :deep(strong) {
  @apply font-bold;
}

/* Emphasis/Italic */
.markdown-content :deep(em) {
  @apply italic;
}

/* Strikethrough */
.markdown-content :deep(s) {
  @apply line-through;
}
</style>
