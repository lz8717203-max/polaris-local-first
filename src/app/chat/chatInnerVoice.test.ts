import { describe, expect, it } from 'vitest';
import {
  applyInnerVoiceToMessage,
  buildInnerVoiceRequestContent,
  sanitizeAssistantInnerVoiceImitation
} from './chatInnerVoice';

describe('chatInnerVoice', () => {
  it('stores spoken text locally while exposing a narrated request to the model', () => {
    const message = applyInnerVoiceToMessage({
      id: 'user-1',
      role: 'user',
      content: '哦。',
      timestamp: 1
    }, '其实很喜欢他。', '哦。');

    expect(message.content).toBe('哦。');
    expect(message.innerVoice).toBe('其实很喜欢他。');
    expect(message.requestContent).toBe('（心声记录：她心里想的是「其实很喜欢他。」，她说出口的是「哦。」）');
  });

  it('allows a pure inner voice with no spoken text', () => {
    expect(buildInnerVoiceRequestContent('别走。', '')).toContain('但她什么都没说');
    const message = applyInnerVoiceToMessage({
      id: 'user-2',
      role: 'user',
      content: '',
      timestamp: 1
    }, '别走。', '');
    expect(message.content).toBe('……');
  });

  it('strips forged inner voice labels from assistant output', () => {
    expect(sanitizeAssistantInnerVoiceImitation('我知道。\n（心声：其实我也舍不得。）\n过来。')).toBe('我知道。\n\n过来。');
  });
});
