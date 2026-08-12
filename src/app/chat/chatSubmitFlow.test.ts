import { describe, expect, it, vi } from 'vitest';
import { submitMessage } from './chatSubmitFlow';

const writableSession = (messages: never[] = []) =>
  vi.fn(async (conversationId: string) => ({
    conversationId,
    conversation: {
      id: conversationId,
      title: 'Test',
      collaboratorId: 'pharos',
      messages
    } as never,
    messages
  }));

describe('submitMessage', () => {
  it('creates a new conversation under the current collaborator when chat has no active thread', async () => {
    const createConversation = vi.fn(() => 'conv-1');
    const addMessage = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());
    const onUserMessageSubmitted = vi.fn();

    await submitMessage({
      inputDraft: '你好',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [],
      activeConversationId: null,
      frontstageCollaboratorId: 'lyra',
      activeCollaboratorId: 'pharos',
      personas: [
        { id: 'pharos' },
        { id: 'lyra' }
      ] as never[]
    }, {
      createConversation,
      ensureConversationWritable: writableSession(),
      addMessage,
      setInputDraft: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      setCommandStatus: vi.fn(),
      submitToolCommand: vi.fn(() => Promise.resolve(false)),
      onUserMessageSubmitted,
      requestReply
    });

    expect(createConversation).toHaveBeenCalledWith('lyra');
    expect(requestReply).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      collaboratorId: 'lyra'
    }));
    expect(onUserMessageSubmitted).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      message: expect.objectContaining({
        role: 'user',
        content: '你好'
      })
    }));
  });

  it('allows sending a referenced card even when the visible draft is empty', async () => {
    const createConversation = vi.fn(() => 'conv-2');
    const addMessage = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());
    const clearPendingCardReference = vi.fn();

    await submitMessage({
      inputDraft: '',
      pendingAttachments: [],
      pendingCardReference: {
        id: 'card-7',
        title: '目标卡',
        language: 'text',
        code: '正文',
        mode: 'continue'
      },
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [],
      activeConversationId: null,
      frontstageCollaboratorId: 'pharos',
      activeCollaboratorId: 'pharos',
      personas: [
        { id: 'pharos' }
      ] as never[]
    }, {
      createConversation,
      ensureConversationWritable: writableSession(),
      addMessage,
      setInputDraft: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference,
      setCommandStatus: vi.fn(),
      submitToolCommand: vi.fn(() => Promise.resolve(false)),
      requestReply
    });

    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-2'
    }), expect.objectContaining({
      role: 'user',
      content: '',
      cardReference: expect.objectContaining({
        id: 'card-7',
        mode: 'continue'
      })
    }));
    expect(clearPendingCardReference).toHaveBeenCalled();
    expect(requestReply).toHaveBeenCalled();
  });

  it('submits into the latest active workspace conversation instead of a stale derived thread', async () => {
    const createConversation = vi.fn(() => 'conv-new');
    const addMessage = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());

    await submitMessage({
      inputDraft: '继续做',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [
        {
          id: 'conv-old',
          collaboratorId: 'pharos',
          messages: [{ id: 'old-user', role: 'user', content: '旧对话', timestamp: 1 }]
        },
        {
          id: 'conv-workspace',
          collaboratorId: 'pharos',
          activeProjectId: 'project-3',
          messages: [{ id: 'workspace-user', role: 'user', content: '在工作区里继续', timestamp: 2 }]
        }
      ] as never[],
      activeConversationId: 'conv-workspace',
      frontstageCollaboratorId: 'pharos',
      activeCollaboratorId: 'pharos',
      personas: [
        { id: 'pharos' }
      ] as never[]
    }, {
      createConversation,
      ensureConversationWritable: writableSession([
        { id: 'workspace-user', role: 'user', content: '在工作区里继续', timestamp: 2 }
      ] as never[]),
      addMessage,
      setInputDraft: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      setCommandStatus: vi.fn(),
      submitToolCommand: vi.fn(() => Promise.resolve(false)),
      requestReply
    });

    expect(createConversation).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-workspace'
    }), expect.objectContaining({
      role: 'user',
      content: '继续做'
    }));
    expect(requestReply).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-workspace',
      collaboratorId: 'pharos',
      messages: [
        expect.objectContaining({ id: 'workspace-user' }),
        expect.objectContaining({ content: '继续做' })
      ]
    }));
  });

  it('starts a current-root conversation instead of writing into a mismatched active thread', async () => {
    const createConversation = vi.fn(() => 'conv-lyra');
    const addMessage = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());

    await submitMessage({
      inputDraft: '跟现在顶栏的人说',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [
        {
          id: 'conv-pharos',
          collaboratorId: 'pharos',
          messages: [{ id: 'old-user', role: 'user', content: '旧对话', timestamp: 1 }]
        }
      ] as never[],
      activeConversationId: 'conv-pharos',
      frontstageCollaboratorId: 'lyra',
      activeCollaboratorId: 'lyra',
      personas: [
        { id: 'pharos' },
        { id: 'lyra' }
      ] as never[]
    }, {
      createConversation,
      ensureConversationWritable: writableSession(),
      addMessage,
      setInputDraft: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      setCommandStatus: vi.fn(),
      submitToolCommand: vi.fn(() => Promise.resolve(false)),
      requestReply
    });

    expect(createConversation).toHaveBeenCalledWith('lyra');
    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-lyra'
    }), expect.objectContaining({
      role: 'user',
      content: '跟现在顶栏的人说'
    }));
    expect(requestReply).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-lyra',
      collaboratorId: 'lyra'
    }));
  });

  it('treats double slash as escaped chat text instead of a command', async () => {
    const createConversation = vi.fn(() => 'conv-escaped');
    const addMessage = vi.fn();
    const submitToolCommand = vi.fn(() => Promise.resolve(false));
    const requestReply = vi.fn(() => Promise.resolve());

    await submitMessage({
      inputDraft: '//ctx',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [],
      activeConversationId: null,
      frontstageCollaboratorId: 'pharos',
      activeCollaboratorId: 'pharos',
      personas: [
        { id: 'pharos' }
      ] as never[]
    }, {
      createConversation,
      ensureConversationWritable: writableSession(),
      addMessage,
      setInputDraft: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      setCommandStatus: vi.fn(),
      submitToolCommand,
      requestReply
    });

    expect(submitToolCommand).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-escaped'
    }), expect.objectContaining({
      role: 'user',
      content: '/ctx'
    }));
    expect(requestReply).toHaveBeenCalled();
  });

  it('does not submit when every collaborator has been deleted', async () => {
    const createConversation = vi.fn(() => 'conv-empty');
    const addMessage = vi.fn();
    const setCommandStatus = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());

    await submitMessage({
      inputDraft: '还在吗',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [],
      activeConversationId: null,
      frontstageCollaboratorId: null,
      activeCollaboratorId: null,
      personas: []
    }, {
      createConversation,
      ensureConversationWritable: writableSession(),
      addMessage,
      setInputDraft: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      setCommandStatus,
      submitToolCommand: vi.fn(() => Promise.resolve(false)),
      requestReply
    });

    expect(createConversation).not.toHaveBeenCalled();
    expect(addMessage).not.toHaveBeenCalled();
    expect(requestReply).not.toHaveBeenCalled();
    expect(setCommandStatus).toHaveBeenCalledWith('当前没有可用协作者，先新建一个协作者再继续聊天。', true);
  });

  it('stops loudly before writing when the conversation body cannot become writable', async () => {
    const addMessage = vi.fn();
    const setInputDraft = vi.fn();
    const setCommandStatus = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());

    await submitMessage({
      inputDraft: '不要消失',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [
        {
          id: 'conv-loading',
          collaboratorId: 'pharos',
          messages: []
        }
      ],
      activeConversationId: 'conv-loading',
      frontstageCollaboratorId: 'pharos',
      activeCollaboratorId: 'pharos',
      personas: [
        { id: 'pharos' }
      ] as never[]
    }, {
      createConversation: vi.fn(() => 'conv-new'),
      ensureConversationWritable: vi.fn(async () => {
        throw new Error('message chunk missing');
      }),
      addMessage,
      setInputDraft,
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      setCommandStatus,
      submitToolCommand: vi.fn(() => Promise.resolve(false)),
      requestReply
    });

    expect(addMessage).not.toHaveBeenCalled();
    expect(setInputDraft).not.toHaveBeenCalled();
    expect(requestReply).not.toHaveBeenCalled();
    expect(setCommandStatus).toHaveBeenCalledWith('读取当前对话历史失败，先别发送，避免用空历史继续。', true);
  });

  it('consumes slash commands without creating a user message', async () => {
    const createConversation = vi.fn(() => 'conv-command');
    const addMessage = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());
    const setInputDraft = vi.fn();
    const clearPendingAttachments = vi.fn();
    const clearPendingCardReference = vi.fn();
    const onUserMessageSubmitted = vi.fn();

    await submitMessage({
      inputDraft: '/ctx',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [],
      activeConversationId: null,
      frontstageCollaboratorId: 'pharos',
      activeCollaboratorId: 'pharos',
      personas: [
        { id: 'pharos' }
      ] as never[]
    }, {
      createConversation,
      ensureConversationWritable: writableSession(),
      addMessage,
      setInputDraft,
      clearPendingAttachments,
      clearPendingCardReference,
      setCommandStatus: vi.fn(),
      submitToolCommand: vi.fn(() => Promise.resolve(true)),
      onUserMessageSubmitted,
      requestReply
    });

    expect(addMessage).not.toHaveBeenCalled();
    expect(requestReply).not.toHaveBeenCalled();
    expect(setInputDraft).toHaveBeenCalledWith('');
    expect(clearPendingAttachments).toHaveBeenCalled();
    expect(clearPendingCardReference).toHaveBeenCalled();
    expect(onUserMessageSubmitted).not.toHaveBeenCalled();
  });

  it('allows a pure inner voice and sends only one model request', async () => {
    const addMessage = vi.fn();
    const requestReply = vi.fn(() => Promise.resolve());
    const submitToolCommand = vi.fn(() => Promise.resolve(false));

    await submitMessage({
      inputDraft: '',
      innerVoice: '别只说你在。你哄哄我。',
      pendingAttachments: [],
      pendingCardReference: null,
      sending: false,
      hasUnsupportedPendingImages: false,
      conversations: [],
      activeConversationId: null,
      frontstageCollaboratorId: 'pharos',
      activeCollaboratorId: 'pharos',
      personas: [{ id: 'pharos' }] as never[]
    }, {
      createConversation: vi.fn(() => 'conv-heart'),
      ensureConversationWritable: writableSession(),
      addMessage,
      setInputDraft: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      setCommandStatus: vi.fn(),
      submitToolCommand,
      requestReply
    });

    expect(submitToolCommand).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      content: '……',
      innerVoice: '别只说你在。你哄哄我。',
      requestContent: expect.stringContaining('但她什么都没说')
    }));
    expect(requestReply).toHaveBeenCalledTimes(1);
  });
});
