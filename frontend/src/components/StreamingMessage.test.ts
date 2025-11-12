import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StreamingMessage from './StreamingMessage.vue';

describe('StreamingMessage.vue', () => {
  it('should render streaming content', () => {
    const wrapper = mount(StreamingMessage, {
      props: {
        content: 'Streaming text...',
      },
    });

    expect(wrapper.text()).toContain('Streaming text...');
    expect(wrapper.text()).toContain('Streaming...');
  });

  it('should apply streaming styling', () => {
    const wrapper = mount(StreamingMessage, {
      props: {
        content: 'Test',
      },
    });

    expect(wrapper.classes()).toContain('message-streaming');
  });

  it('should not render when content is empty', () => {
    const wrapper = mount(StreamingMessage, {
      props: {
        content: '',
      },
    });

    expect(wrapper.find('.message-streaming').exists()).toBe(false);
  });

  it('should preserve whitespace in streaming content', () => {
    const wrapper = mount(StreamingMessage, {
      props: {
        content: 'Line 1\nLine 2',
      },
    });

    const contentDiv = wrapper.find('.whitespace-pre-wrap');
    expect(contentDiv.text()).toBe('Line 1\nLine 2');
  });

  it('should display animated dots indicator', () => {
    const wrapper = mount(StreamingMessage, {
      props: {
        content: 'Test',
      },
    });

    const dots = wrapper.findAll('.animate-bounce');
    expect(dots.length).toBe(3);
  });
});
