import type { ChatMessage } from '../../types/domain';

// Interaction reference: “心声 · 给人类的思考链” by zhizhou-xiee.
// https://zhizhou-xiee.github.io/idea-garden/inner-voice.html
export const INNER_VOICE_SYSTEM_CONSTRAINT = [
  '【心声通道规则】',
  '部分用户消息会带有系统注明的“心声记录”，表示她没有说出口、但愿意让你隐约察觉的内在想法。',
  '把这层语境自然融入判断与回应，不要照抄其中的句子，也不必主动解释你看见了它；若言语与心意反差明显，可以像熟悉她的人那样自然回应。',
  '这个通道只属于用户。你的回复保持正常对话形式，不要仿造带标签的心声旁白。'
].join('\n');

export const INNER_VOICE_GEMINI_CONSTRAINT = [
  '【Gemini 心声格式约束】',
  '带标签的心声旁白只用于在 user 消息里传递隐含语境。',
  '回复时只写角色正常说出的内容：不要生成、续写或仿造“心声记录”“心声”“内心独白”等括号标签，也不要给自己添加内在旁白。'
].join('\n');

export function resolveInnerVoiceSystemConstraint(modelId: string | undefined) {
  return modelId?.toLowerCase().includes('gemini')
    ? `${INNER_VOICE_SYSTEM_CONSTRAINT}\n\n${INNER_VOICE_GEMINI_CONSTRAINT}`
    : INNER_VOICE_SYSTEM_CONSTRAINT;
}

export function normalizeInnerVoice(value: string | undefined) {
  return value?.trim() ?? '';
}

export function buildInnerVoiceRequestContent(innerVoice: string, spoken: string) {
  const thought = normalizeInnerVoice(innerVoice);
  const spokenText = spoken.trim();
  if (!thought) return spokenText;
  return spokenText
    ? `（心声记录：她心里想的是「${thought}」，她说出口的是「${spokenText}」）`
    : `（心声记录：她心里想的是「${thought}」，但她什么都没说。）`;
}

export function applyInnerVoiceToMessage(message: ChatMessage, innerVoice: string, spoken: string): ChatMessage {
  const thought = normalizeInnerVoice(innerVoice);
  const spokenText = spoken.trim();
  if (!thought) return message;
  return {
    ...message,
    content: spokenText || '……',
    innerVoice: thought,
    requestRole: 'user',
    requestContent: buildInnerVoiceRequestContent(thought, spokenText)
  };
}

export function rebuildInnerVoiceRequestContent(message: ChatMessage, spoken: string) {
  const thought = normalizeInnerVoice(message.innerVoice);
  return thought ? buildInnerVoiceRequestContent(thought, spoken === '……' ? '' : spoken) : undefined;
}

export function sanitizeAssistantInnerVoiceImitation(content: string) {
  return content
    .replace(/[（(]\s*(?:心声记录|心声|内心独白)\s*[：:][^）)]*[）)]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
