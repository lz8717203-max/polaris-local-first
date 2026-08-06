const MAX_MULTI_MESSAGE_PARTS = 5;
const MIN_MULTI_MESSAGE_LENGTH = 18;

export type ResolveAssistantMessagePartsArgs = {
  content: string;
  enabled: boolean;
  safeToSplit: boolean;
};

function containsStructuredContent(content: string) {
  const lines = content.split('\n');
  return (
    /```|~~~|<tool\b|<function\b|\$\$|<table\b|<pre\b/i.test(content)
    || lines.some((line) => /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(line))
    || lines.some((line) => /^\s*\|.*\|\s*$/.test(line))
    || /^\s*[\[{][\s\S]*[\]}]\s*$/.test(content)
  );
}

function sentenceUnits(content: string) {
  const units: string[] = [];
  let start = 0;

  const push = (endExclusive: number) => {
    const value = content.slice(start, endExclusive).trim();
    if (value) units.push(value);
    start = endExclusive;
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1] ?? '';
    const previous = content[index - 1] ?? '';
    const isStrongBoundary = '。！？!?'.includes(char);
    const isEllipsisBoundary = char === '…' && next !== '…';
    const isEnglishPeriod = char === '.'
      && (!next || /\s/.test(next))
      && !(/\d/.test(previous) && /\d/.test(next));
    const isLineBoundary = char === '\n';

    if (!(isStrongBoundary || isEllipsisBoundary || isEnglishPeriod || isLineBoundary)) continue;

    let end = index + 1;
    while (end < content.length && /[”’"'）】》]/.test(content[end])) end += 1;
    push(end);
    index = end - 1;
  }

  push(content.length);
  return units;
}

function desiredPartCount(length: number, unitCount: number) {
  const byLength = length < 70 ? 2 : length < 150 ? 3 : length < 260 ? 4 : 5;
  return Math.max(2, Math.min(MAX_MULTI_MESSAGE_PARTS, byLength, unitCount));
}

function combineUnits(units: string[], targetCount: number) {
  if (units.length <= targetCount) return units;
  const totalLength = units.reduce((sum, unit) => sum + unit.length, 0);
  const targetLength = Math.max(12, Math.ceil(totalLength / targetCount));
  const parts: string[] = [];
  let current = '';

  units.forEach((unit, index) => {
    const remainingUnits = units.length - index;
    const remainingParts = targetCount - parts.length;
    const mustClose = remainingUnits === remainingParts;
    const nextValue = current ? `${current}${unit.startsWith('\n') ? '' : ' '}${unit}` : unit;

    if (current && (nextValue.length > targetLength || mustClose)) {
      parts.push(current.trim());
      current = unit;
    } else {
      current = nextValue;
    }
  });

  if (current.trim()) parts.push(current.trim());

  while (parts.length > targetCount) {
    const tail = parts.pop();
    if (!tail) break;
    parts[parts.length - 1] = `${parts[parts.length - 1]} ${tail}`.trim();
  }
  return parts;
}

function rebalanceTinyParts(parts: string[]) {
  const result = [...parts];
  for (let index = 0; index < result.length; index += 1) {
    if (result[index].length >= 5 || result.length <= 2) continue;
    if (index > 0) {
      result[index - 1] = `${result[index - 1]} ${result[index]}`.trim();
      result.splice(index, 1);
      index -= 1;
    } else if (result[1]) {
      result[1] = `${result[0]} ${result[1]}`.trim();
      result.splice(0, 1);
      index -= 1;
    }
  }
  return result;
}

export function resolveAssistantMessageParts({
  content,
  enabled,
  safeToSplit
}: ResolveAssistantMessagePartsArgs): string[] {
  const normalized = content.trim();
  if (!enabled || !safeToSplit || normalized.length < MIN_MULTI_MESSAGE_LENGTH) return [normalized];
  if (containsStructuredContent(normalized)) return [normalized];

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const units = paragraphs.length >= 2 && paragraphs.length <= MAX_MULTI_MESSAGE_PARTS
    ? paragraphs
    : sentenceUnits(normalized);

  if (units.length < 2) return [normalized];
  const parts = rebalanceTinyParts(combineUnits(units, desiredPartCount(normalized.length, units.length)))
    .filter(Boolean)
    .slice(0, MAX_MULTI_MESSAGE_PARTS);
  return parts.length >= 2 ? parts : [normalized];
}

export function multiMessageDelayMs(previousPart: string, index: number) {
  return Math.min(900, 260 + Math.min(previousPart.length, 80) * 7 + index * 45);
}

export async function waitForMultiMessageDelay(previousPart: string, index: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, multiMessageDelayMs(previousPart, index));
  });
}
