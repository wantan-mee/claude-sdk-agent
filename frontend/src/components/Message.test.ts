import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Message from './Message.vue';

describe('Message.vue', () => {
  it('should render user message with correct styling', () => {
    const wrapper = mount(Message, {
      props: {
        message: {
          role: 'user',
          content: 'Hello from user',
          timestamp: Date.now(),
        },
      },
    });

    expect(wrapper.text()).toContain('Hello from user');
    expect(wrapper.classes()).toContain('message-user');
  });

  it('should render assistant message with correct styling', () => {
    const wrapper = mount(Message, {
      props: {
        message: {
          role: 'assistant',
          content: 'Hello from assistant',
          timestamp: Date.now(),
        },
      },
    });

    expect(wrapper.text()).toContain('Hello from assistant');
    expect(wrapper.classes()).toContain('message-assistant');
  });

  it('should format timestamp correctly', () => {
    const timestamp = new Date('2024-01-01T12:30:00').getTime();
    const wrapper = mount(Message, {
      props: {
        message: {
          role: 'user',
          content: 'Test message',
          timestamp,
        },
      },
    });

    // Check that time is displayed (format depends on locale)
    expect(wrapper.text()).toMatch(/\d{1,2}:\d{2}/);
  });

  it('should preserve whitespace in content', () => {
    const wrapper = mount(Message, {
      props: {
        message: {
          role: 'user',
          content: 'Line 1\nLine 2\n  Indented',
          timestamp: Date.now(),
        },
      },
    });

    const contentDiv = wrapper.find('.whitespace-pre-wrap');
    expect(contentDiv.text()).toBe('Line 1\nLine 2\n  Indented');
  });

  it('should handle long messages with word break', () => {
    const longWord = 'a'.repeat(100);
    const wrapper = mount(Message, {
      props: {
        message: {
          role: 'user',
          content: longWord,
          timestamp: Date.now(),
        },
      },
    });

    const contentDiv = wrapper.find('.break-words');
    expect(contentDiv.exists()).toBe(true);
    expect(contentDiv.text()).toBe(longWord);
  });

  it('should handle empty content', () => {
    const wrapper = mount(Message, {
      props: {
        message: {
          role: 'user',
          content: '',
          timestamp: Date.now(),
        },
      },
    });

    expect(wrapper.find('.whitespace-pre-wrap').text()).toBe('');
  });
});
