import { describe, expect, it, vi } from 'vitest';
import { createStreamingReplyCollector } from '../../engines/chat-api/chatApiStreamingCollector';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ChatMessage } from '../../types/domain';
import type { ChatStreamingState } from './chatPorts';
import {
  resolveAssistantStreamingChrome,
  resolveChatGenerationActive,
  resolveChatMessageLifecycle,
  resolveChatStreamingPresentation
} from './chatStreamingDisplay';
import { createStreamingSession } from './chatStreamingSession';

type RafCallback = (timestamp: number) => void;

function buildWritableConversation(messages: ChatMessage[] = []): WritableConversationBody {
  return {
    conversationId: 'conv_1',
    conversation: {
      id: 'conv_1',
      title: '测试对话',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages
    },
    messages
  };
}

describe('createStreamingSession', () => {
  it('keeps the placeholder in stage until the first streamed patch flushes', () => {
    let streamingState: ChatStreamingState = null;
    let scheduledFrame: RafCallback | null = null;
    const addMessage = vi.fn();
    const updateMessage = vi.fn();
    const requestAnimationFrame = vi.fn((callback: RafCallback) => {
      scheduledFrame = callback;
      return 1;
    });
    const cancelAnimationFrame = vi.fn();

    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      requestAnimationFrame,
      cancelAnimationFrame
    });

    try {
      const session = createStreamingSession({
        ui: {
          abortControllerRef: { current: null },
          streamingLifecycleReleaseRef: { current: null },
          setSending: vi.fn(),
          setStreaming: (value) => {
            streamingState = typeof value === 'function' ? value(streamingState) : value;
          }
        },
        chat: {
          addMessage,
          updateMessage
        },
        conversationId: 'conv_1',
        writableConversation: buildWritableConversation(),
        placeholderId: 'assistant_1',
        assistantName: 'Pharos',
        modelTier: 'medium',
        themeToolMode: 'stable'
      });

      session.start();
      expect(streamingState).toEqual({ messageId: 'assistant_1', phase: 'stage' });

      session.queueProgress({ content: '第一行字' });
      expect(streamingState).toEqual({ messageId: 'assistant_1', phase: 'stage' });
      expect(updateMessage).not.toHaveBeenCalled();

      const firstFrame = scheduledFrame as RafCallback | null;
      if (firstFrame) {
        firstFrame(0);
      }

      expect(updateMessage).toHaveBeenCalledOnce();
      expect(streamingState).toEqual({ messageId: 'assistant_1', phase: 'live' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('can keep streamed text hidden while preserving the live lifecycle', () => {
    let streamingState: ChatStreamingState = null;
    let scheduledFrame: RafCallback | null = null;
    const updateMessage = vi.fn();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      requestAnimationFrame: (callback: RafCallback) => {
        scheduledFrame = callback;
        return 1;
      },
      cancelAnimationFrame: vi.fn()
    });

    try {
      const session = createStreamingSession({
        ui: {
          abortControllerRef: { current: null },
          streamingLifecycleReleaseRef: { current: null },
          setSending: vi.fn(),
          setStreaming: (value) => {
            streamingState = typeof value === 'function' ? value(streamingState) : value;
          }
        },
        chat: { addMessage: vi.fn(), updateMessage },
        conversationId: 'conv_1',
        writableConversation: buildWritableConversation(),
        placeholderId: 'assistant_1',
        assistantName: 'Pharos',
        modelTier: 'medium',
        themeToolMode: 'stable',
        suppressVisibleProgress: true
      });

      session.start();
      session.queueProgress({ content: '先不显示这段流式文字' });
      const frame = scheduledFrame as RafCallback | null;
      frame?.(0);

      expect(updateMessage).not.toHaveBeenCalled();
      expect(streamingState).toEqual({ messageId: 'assistant_1', phase: 'live' });
      expect(session.getLatestProgress()?.content).toBe('先不显示这段流式文字');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throttles heavy streamed code patches before rendering them', () => {
    let streamingState: ChatStreamingState = null;
    let scheduledFrame: RafCallback | null = null;
    let scheduledTimeout: (() => void) | null = null;
    const addMessage = vi.fn();
    const updateMessage = vi.fn();
    const requestAnimationFrame = vi.fn((callback: RafCallback) => {
      scheduledFrame = callback;
      return 1;
    });
    const cancelAnimationFrame = vi.fn();
    const setTimeoutMock = vi.fn((callback: () => void) => {
      scheduledTimeout = callback;
      return 2;
    });
    const clearTimeoutMock = vi.fn();

    vi.stubGlobal('window', {
      setTimeout: setTimeoutMock,
      clearTimeout: clearTimeoutMock,
      requestAnimationFrame,
      cancelAnimationFrame
    });

    try {
      const session = createStreamingSession({
        ui: {
          abortControllerRef: { current: null },
          streamingLifecycleReleaseRef: { current: null },
          setSending: vi.fn(),
          setStreaming: (value) => {
            streamingState = typeof value === 'function' ? value(streamingState) : value;
          }
        },
        chat: {
          addMessage,
          updateMessage
        },
        conversationId: 'conv_1',
        writableConversation: buildWritableConversation(),
        placeholderId: 'assistant_1',
        assistantName: 'Pharos',
        modelTier: 'medium',
        themeToolMode: 'stable'
      });

      session.start();
      session.queueProgress({ content: '开头' });
      const firstFrame = scheduledFrame as RafCallback | null;
      if (firstFrame) {
        firstFrame(0);
      }
      expect(updateMessage).toHaveBeenCalledOnce();
      updateMessage.mockClear();
      requestAnimationFrame.mockClear();
      scheduledFrame = null;

      session.queueProgress({
        content: [
          '```html',
          '<main>',
          '  <section>长页面</section>',
          '</main>',
          '```'
        ].join('\n')
      });

      expect(setTimeoutMock).toHaveBeenCalled();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(updateMessage).not.toHaveBeenCalled();

      const timeoutCallback = scheduledTimeout as (() => void) | null;
      if (!timeoutCallback) throw new Error('Expected a throttled streaming timeout.');
      timeoutCallback();
      expect(requestAnimationFrame).toHaveBeenCalledOnce();
      const frameCallback = scheduledFrame as RafCallback | null;
      if (!frameCallback) throw new Error('Expected a streaming animation frame.');
      frameCallback(0);

      expect(updateMessage).toHaveBeenCalledOnce();
      expect(streamingState).toEqual({ messageId: 'assistant_1', phase: 'live' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps thinking, content, and an incomplete transport on the same live placeholder', () => {
    let sending = false;
    let streamingState: ChatStreamingState = null;
    let scheduledFrame: RafCallback | null = null;
    let scheduledLifecycleRelease: (() => void) | null = null;
    let messages: ChatMessage[] = [];
    const requestAnimationFrame = vi.fn((callback: RafCallback) => {
      scheduledFrame = callback;
      return 1;
    });
    const cancelAnimationFrame = vi.fn();
    const setTimeoutMock = vi.fn((callback: () => void) => {
      scheduledLifecycleRelease = callback;
      return 2;
    });
    const clearTimeoutMock = vi.fn();

    vi.stubGlobal('window', {
      setTimeout: setTimeoutMock,
      clearTimeout: clearTimeoutMock,
      requestAnimationFrame,
      cancelAnimationFrame
    });

    const flushNextFrame = () => {
      const frame = scheduledFrame;
      if (!frame) throw new Error('Expected a streaming animation frame.');
      scheduledFrame = null;
      frame(0);
    };

    try {
      const session = createStreamingSession({
        ui: {
          abortControllerRef: { current: null },
          streamingLifecycleReleaseRef: { current: null },
          setSending: (value) => {
            sending = value;
          },
          setStreaming: (value) => {
            streamingState = typeof value === 'function' ? value(streamingState) : value;
          }
        },
        chat: {
          addMessage: (_conversationId, message) => {
            messages = [...messages, message];
          },
          updateMessage: (_conversationId, messageId, patch) => {
            messages = messages.map((message) =>
              message.id === messageId ? { ...message, ...patch } : message
            );
          }
        },
        conversationId: 'conv_1',
        writableConversation: buildWritableConversation(),
        placeholderId: 'assistant_1',
        assistantName: 'Pharos',
        modelTier: 'medium',
        themeToolMode: 'stable'
      });
      const collector = createStreamingReplyCollector('test-model', session.queueProgress);

      session.start();
      expect(resolveChatStreamingPresentation({
        showThinking: true,
        sending,
        messages,
        streaming: streamingState
      })).toEqual({
        displayStreaming: { messageId: 'assistant_1', phase: 'stage' },
        showLiveThinking: false
      });

      collector.pushTextChunk(
        'data: {"choices":[{"delta":{"reasoning_content":"先确认目标。"}}]}\n\n',
        true
      );
      flushNextFrame();

      expect(messages[0]).toEqual(expect.objectContaining({
        id: 'assistant_1',
        content: '',
        thinkingText: '先确认目标。'
      }));
      expect(resolveChatStreamingPresentation({
        showThinking: true,
        sending,
        messages,
        streaming: streamingState
      })).toEqual({
        displayStreaming: { messageId: 'assistant_1', phase: 'live' },
        showLiveThinking: false
      });

      collector.pushTextChunk(
        'data: {"choices":[{"delta":{"content":"这是正文。"}}]}\n\n',
        true
      );
      flushNextFrame();

      expect(messages[0]).toEqual(expect.objectContaining({
        id: 'assistant_1',
        content: '这是正文。',
        thinkingText: '先确认目标。'
      }));
      const incompleteReply = collector.finish();
      expect(incompleteReply.transportIncomplete).toBe(true);

      session.scheduleLifecycleRelease(320);
      session.finish(true);

      expect(sending).toBe(false);
      expect(scheduledLifecycleRelease).toBeTypeOf('function');
      expect(resolveChatGenerationActive({
        sending,
        streaming: streamingState
      })).toBe(false);
      expect(resolveChatStreamingPresentation({
        showThinking: true,
        sending,
        messages,
        streaming: streamingState
      })).toEqual({
        displayStreaming: { messageId: 'assistant_1', phase: 'settling' },
        showLiveThinking: false
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('preserves the visible order from prelude to thinking, prose, and settling', () => {
    let sending = false;
    let streamingState: ChatStreamingState = null;
    let scheduledFrame: RafCallback | null = null;
    let scheduledLifecycleRelease: (() => void) | null = null;
    let messages: ChatMessage[] = [];
    const requestAnimationFrame = vi.fn((callback: RafCallback) => {
      scheduledFrame = callback;
      return 1;
    });
    const cancelAnimationFrame = vi.fn();
    const setTimeoutMock = vi.fn((callback: () => void) => {
      scheduledLifecycleRelease = callback;
      return 2;
    });
    const clearTimeoutMock = vi.fn();

    vi.stubGlobal('window', {
      setTimeout: setTimeoutMock,
      clearTimeout: clearTimeoutMock,
      requestAnimationFrame,
      cancelAnimationFrame
    });

    const flushNextFrame = () => {
      const frame = scheduledFrame;
      if (!frame) throw new Error('Expected a streaming animation frame.');
      scheduledFrame = null;
      frame(0);
    };
    const currentChrome = () => {
      const message = messages[0];
      if (!message) throw new Error('Expected the streaming placeholder.');
      const lifecycle = resolveChatMessageLifecycle({
        messageId: message.id,
        streaming: streamingState,
        enteringMessageIds: []
      });
      return {
        lifecycle,
        chrome: resolveAssistantStreamingChrome({
          message,
          lifecycle,
          showThinking: true
        }),
        presentation: resolveChatStreamingPresentation({
          showThinking: true,
          sending,
          messages,
          streaming: streamingState
        })
      };
    };

    try {
      const session = createStreamingSession({
        ui: {
          abortControllerRef: { current: null },
          streamingLifecycleReleaseRef: { current: null },
          setSending: (value) => {
            sending = value;
          },
          setStreaming: (value) => {
            streamingState = typeof value === 'function' ? value(streamingState) : value;
          }
        },
        chat: {
          addMessage: (_conversationId, message) => {
            messages = [...messages, message];
          },
          updateMessage: (_conversationId, messageId, patch) => {
            messages = messages.map((message) =>
              message.id === messageId ? { ...message, ...patch } : message
            );
          }
        },
        conversationId: 'conv_1',
        writableConversation: buildWritableConversation(),
        placeholderId: 'assistant_1',
        assistantName: 'Pharos',
        modelTier: 'medium',
        themeToolMode: 'stable'
      });
      const collector = createStreamingReplyCollector('test-model', session.queueProgress);

      session.start();
      expect(currentChrome()).toEqual({
        lifecycle: 'streaming-stage',
        chrome: {
          showPrelude: true,
          showHint: false,
          showLiveHint: false
        },
        presentation: {
          displayStreaming: { messageId: 'assistant_1', phase: 'stage' },
          showLiveThinking: false
        }
      });

      collector.pushTextChunk(
        'data: {"choices":[{"delta":{"reasoning_content":"先确认目标。"}}]}\n\n',
        true
      );
      flushNextFrame();
      expect(currentChrome()).toEqual({
        lifecycle: 'streaming-live',
        chrome: {
          showPrelude: false,
          showHint: false,
          showLiveHint: false
        },
        presentation: {
          displayStreaming: { messageId: 'assistant_1', phase: 'live' },
          showLiveThinking: false
        }
      });

      collector.pushTextChunk(
        'data: {"choices":[{"delta":{"content":"这是正文。"}}]}\n\n',
        true
      );
      flushNextFrame();
      expect(currentChrome()).toEqual({
        lifecycle: 'streaming-live',
        chrome: {
          showPrelude: false,
          showHint: true,
          showLiveHint: true
        },
        presentation: {
          displayStreaming: { messageId: 'assistant_1', phase: 'live' },
          showLiveThinking: false
        }
      });

      session.scheduleLifecycleRelease(320);
      session.finish(true);

      expect(scheduledLifecycleRelease).toBeTypeOf('function');
      expect(currentChrome()).toEqual({
        lifecycle: 'settling',
        chrome: {
          showPrelude: false,
          showHint: false,
          showLiveHint: false
        },
        presentation: {
          displayStreaming: { messageId: 'assistant_1', phase: 'settling' },
          showLiveThinking: false
        }
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
