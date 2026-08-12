import type { AppLanguage } from '../../i18n/appLanguage';
import { createTranslator } from '../../i18n/translator';
import type { CodeCard, Conversation } from '../../types/domain';

export { codeCardBlockLabel, codeCardOriginLabel, imageAssetOriginLabel } from '../../engines/collectionCardOrigin';

export const BLANK_CARD_SNIPPET = `<!-- 新卡片 -->
<section class="demo-card">
  <h1>Polaris Card</h1>
  <p>在这里开始写你的卡片。</p>
</section>`;

export function sourceLabel(card: CodeCard) {
  switch (card.source) {
    case 'chat-generated':
      return 'chat';
    case 'imported':
      return 'imported';
    default:
      return 'manual';
  }
}

export function firstLines(value: string, lineCount: number) {
  if (lineCount <= 0) return '';

  let cursor = 0;
  for (let index = 0; index < lineCount; index += 1) {
    const nextBreak = value.indexOf('\n', cursor);
    if (nextBreak === -1) return value;
    if (index === lineCount - 1) return value.slice(0, nextBreak);
    cursor = nextBreak + 1;
  }

  return value;
}

export function codePreview(card: CodeCard) {
  return firstLines(card.code, 6);
}

export function recentConversationCopy(conversation: Conversation, language: AppLanguage = 'zh-CN') {
  const { t } = createTranslator(language);
  const recentMessage = [...conversation.messages]
    .reverse()
    .find((message) => message.content.trim());

  if (recentMessage?.innerVoice?.trim()) {
    const content = recentMessage.content.trim();
    return content && content !== '……' ? `[心声] ${content}` : '[心声]';
  }
  return recentMessage?.content || t('collection.conversation.emptyExcerpt');
}

export function conversationArchiveDateLabel(conversation: Conversation) {
  return collectionArchiveDateLabel(conversation.updatedAt);
}

export function collectionArchiveDateLabel(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const currentYear = new Date().getFullYear();
  return year === currentYear ? `${month}.${day}` : `${year}.${month}.${day}`;
}

export function collectionRelativeDateLabel(timestamp: number, language: AppLanguage = 'zh-CN') {
  const { t } = createTranslator(language);
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return t('relative.justNow');
  if (diff < 3_600_000) return t('relative.minutesAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('relative.hoursAgo', { count: Math.floor(diff / 3_600_000) });
  if (diff < 172_800_000) return t('relative.yesterday');
  if (diff < 604_800_000) return t('relative.daysAgo', { count: Math.floor(diff / 86_400_000) });
  return t('relative.lastWeek');
}

export function conversationUpdatedLabel(conversation: Conversation, language: AppLanguage = 'zh-CN') {
  const { t } = createTranslator(language);
  return conversation.pinnedAt ? t('common.pinned') : collectionRelativeDateLabel(conversation.updatedAt, language);
}
