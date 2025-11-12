import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import InputBox from './InputBox.vue';

describe('InputBox.vue', () => {
  it('should render textarea and buttons', () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    expect(wrapper.find('textarea').exists()).toBe(true);
    expect(wrapper.find('button:nth-of-type(1)').text()).toContain('Send');
    expect(wrapper.find('button:nth-of-type(2)').text()).toContain('Clear');
  });

  it('should emit send event when Send button is clicked', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Test message');

    const sendButton = wrapper.find('button:nth-of-type(1)');
    await sendButton.trigger('click');

    expect(wrapper.emitted('send')).toBeTruthy();
    expect(wrapper.emitted('send')?.[0]).toEqual(['Test message']);
  });

  it('should clear input after sending', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Test message');
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Test message');

    const sendButton = wrapper.find('button:nth-of-type(1)');
    await sendButton.trigger('click');

    expect((textarea.element as HTMLTextAreaElement).value).toBe('');
  });

  it('should emit send event when Enter is pressed', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Test message');
    await textarea.trigger('keydown.enter', { shiftKey: false });

    expect(wrapper.emitted('send')).toBeTruthy();
    expect(wrapper.emitted('send')?.[0]).toEqual(['Test message']);
  });

  it('should not send when Shift+Enter is pressed', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Test message');
    await textarea.trigger('keydown.enter', { shiftKey: true });

    expect(wrapper.emitted('send')).toBeFalsy();
  });

  it('should not send empty messages', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const sendButton = wrapper.find('button:nth-of-type(1)');
    await sendButton.trigger('click');

    expect(wrapper.emitted('send')).toBeFalsy();
  });

  it('should not send whitespace-only messages', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('   \n   ');

    const sendButton = wrapper.find('button:nth-of-type(1)');
    await sendButton.trigger('click');

    expect(wrapper.emitted('send')).toBeFalsy();
  });

  it('should disable inputs when streaming', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: true,
      },
    });

    const textarea = wrapper.find('textarea');
    const sendButton = wrapper.find('button:nth-of-type(1)');
    const clearButton = wrapper.find('button:nth-of-type(2)');

    expect(textarea.attributes('disabled')).toBeDefined();
    expect(sendButton.attributes('disabled')).toBeDefined();
    expect(clearButton.attributes('disabled')).toBeDefined();
  });

  it('should show "Sending..." text when streaming', () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: true,
      },
    });

    const sendButton = wrapper.find('button:nth-of-type(1)');
    expect(sendButton.text()).toContain('Sending...');
  });

  it('should emit clear event when Clear button is clicked', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const clearButton = wrapper.find('button:nth-of-type(2)');
    await clearButton.trigger('click');

    expect(wrapper.emitted('clear')).toBeTruthy();
  });

  it('should trim whitespace from messages before sending', async () => {
    const wrapper = mount(InputBox, {
      props: {
        isStreaming: false,
      },
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('  Test message  ');

    const sendButton = wrapper.find('button:nth-of-type(1)');
    await sendButton.trigger('click');

    expect(wrapper.emitted('send')?.[0]).toEqual(['Test message']);
  });
});
