import { describe, expect, it } from 'vitest';
import { multiMessageDelayMs, resolveAssistantMessageParts } from './chatMultiMessage';

describe('chatMultiMessage', () => {
  it('splits ordinary short conversation into natural message parts', () => {
    const parts = resolveAssistantMessageParts({
      content: '我知道。你先别急。等我把这件事理顺，再跟你说清楚。',
      enabled: true,
      safeToSplit: true
    });
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.length).toBeLessThanOrEqual(5);
    expect(parts.join('')).toContain('我知道');
  });

  it('keeps code and markdown structures in one message', () => {
    const code = '这样改：\n```ts\nconst value = 1;\n```';
    expect(resolveAssistantMessageParts({ content: code, enabled: true, safeToSplit: true })).toEqual([code]);

    const list = '- 第一步\n- 第二步';
    expect(resolveAssistantMessageParts({ content: list, enabled: true, safeToSplit: true })).toEqual([list]);
  });

  it('does not split when disabled or unsafe', () => {
    const content = '第一句。第二句。第三句。';
    expect(resolveAssistantMessageParts({ content, enabled: false, safeToSplit: true })).toEqual([content]);
    expect(resolveAssistantMessageParts({ content, enabled: true, safeToSplit: false })).toEqual([content]);
  });

  it('uses a bounded natural delay', () => {
    expect(multiMessageDelayMs('短句', 1)).toBeGreaterThanOrEqual(260);
    expect(multiMessageDelayMs('很长'.repeat(100), 4)).toBeLessThanOrEqual(900);
  });
});
