import { describe, expect, it } from 'vitest';
import { prepareConversationMessages } from './requestConversationPreparation';

describe('requestConversationPreparation', () => {
  it('materializes user card references into request-visible system messages', () => {
    const { messages } = prepareConversationMessages([
      {
        id: 'user-1',
        role: 'user',
        content: '',
        timestamp: 1,
        cardReference: {
          id: 'card-1',
          title: '目标卡片',
          cardNote: '像压在角落的一句批注。',
          language: 'text',
          code: '给你留的位置。',
          cardFaceCss: '& { --code-card-face-panel-top: #eef6ff; }',
          mode: 'continue'
        }
      }
    ], null);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(expect.objectContaining({
      id: 'user-1:card-reference',
      role: 'system'
    }));
    expect(messages[0]?.content).toContain('```polaris-card-reference');
    expect(messages[0]?.content).toContain('卡面小字：');
    expect(messages[0]?.content).toContain('卡面 CSS：');
    expect(messages[1]).toEqual(expect.objectContaining({
      id: 'user-1',
      role: 'user',
      cardReference: expect.objectContaining({
        id: 'card-1'
      })
    }));
  });

  it('keeps reference cards from becoming default write targets', () => {
    const { messages } = prepareConversationMessages([
      {
        id: 'user-1',
        role: 'user',
        content: '看看这张',
        timestamp: 1,
        cardReference: {
          id: 'card-1',
          title: '参考卡片',
          language: 'text',
          code: '给你参考。',
          mode: 'reference'
        }
      }
    ], null);

    expect(messages[0]?.content).toContain('参考材料，不是默认修改目标');
  });

  it('projects trigger runtime messages through request-only content', () => {
    const { messages } = prepareConversationMessages([
      {
        id: 'trigger-1',
        role: 'system',
        content: '（主动唤醒：晚安）',
        timestamp: 1,
        origin: 'trigger-runtime',
        requestRole: 'user',
        requestContent: '看看我今天状态'
      }
    ], null);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(expect.objectContaining({
      id: 'trigger-1',
      role: 'user',
      content: '看看我今天状态',
      origin: 'trigger-runtime'
    }));
  });

  it('adds one inner voice channel constraint and keeps the narrated user request', () => {
    const { messages } = prepareConversationMessages([
      {
        id: 'user-heart-1',
        role: 'user',
        content: '哦。',
        timestamp: 2,
        innerVoice: '好喜欢他。',
        requestRole: 'user',
        requestContent: '（心声记录：她心里想的是「好喜欢他。」，她说出口的是「哦。」）'
      }
    ], null);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(expect.objectContaining({
      id: 'inner-voice-channel:system',
      role: 'system'
    }));
    expect(messages[0]?.content).toContain('不要照抄');
    expect(messages[0]?.content).not.toContain('Gemini 心声格式约束');
    expect(messages[1]).toEqual(expect.objectContaining({
      id: 'user-heart-1',
      role: 'user',
      content: '（心声记录：她心里想的是「好喜欢他。」，她说出口的是「哦。」）'
    }));
    expect(messages[1]).not.toHaveProperty('innerVoice');
  });

  it('adds the stricter anti-imitation constraint for Gemini models', () => {
    const { messages } = prepareConversationMessages([
      {
        id: 'user-heart-gemini',
        role: 'user',
        content: '哦。',
        timestamp: 2,
        innerVoice: '其实很在意。',
        requestContent: '（心声记录：她心里想的是「其实很在意。」，她说出口的是「哦。」）'
      }
    ], null, { modelId: 'gemini-2.5-pro' });

    expect(messages[0]?.content).toContain('Gemini 心声格式约束');
    expect(messages[0]?.content).toContain('也不要给自己添加内在旁白');
  });

  it('keeps provider failure evidence visible locally without replaying raw dumps as assistant history', () => {
    const rawFailure = 'API 返回为空：{"id":"chatcmpl-test","model":"gpt-5.5","choices":[{"message":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":20131,"completion_tokens":0}}';
    const { messages } = prepareConversationMessages([
      {
        id: 'assistant-error',
        role: 'assistant',
        content: rawFailure,
        timestamp: 1,
        origin: 'assistant-reply',
        assistantName: 'Nova'
      },
      {
        id: 'user-2',
        role: 'user',
        content: '继续',
        timestamp: 2
      }
    ], null);

    expect(messages[0]).toEqual(expect.objectContaining({
      id: 'assistant-error',
      role: 'system',
      origin: 'assistant-reply'
    }));
    expect(messages[0]?.content).toContain('Polaris 本地请求诊断');
    expect(messages[0]?.content).toContain('input_tokens=20131');
    expect(messages[0]?.content).not.toContain('chatcmpl-test');
    expect(messages[0]?.content).not.toContain('"choices"');
    expect(messages[1]).toEqual(expect.objectContaining({
      id: 'user-2',
      role: 'user',
      content: '继续'
    }));
  });

  it('does not rewrite user-provided API payload examples', () => {
    const rawUserText = 'API 返回为空：{"choices":[{"message":{"content":""}}]}';
    const { messages } = prepareConversationMessages([
      {
        id: 'user-1',
        role: 'user',
        content: rawUserText,
        timestamp: 1
      }
    ], null);

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'user-1',
        role: 'user',
        content: rawUserText
      })
    ]);
  });

  it('does not rewrite real assistant replies that discuss API payloads', () => {
    const content = 'API 400: 这通常代表请求格式被上游拒绝。';
    const { messages } = prepareConversationMessages([
      {
        id: 'assistant-1',
        role: 'assistant',
        content,
        timestamp: 1,
        origin: 'assistant-reply',
        providerId: 'provider-1',
        model: 'gpt-test'
      }
    ], null);

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'assistant-1',
        role: 'assistant',
        content
      })
    ]);
  });
});
