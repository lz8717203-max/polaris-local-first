import {
  buildMemorySegmentLines,
  buildWeightedMemoryLines,
  describeMemoryItem
} from '../memoryEngine';
import type { PersonaMemorySettings } from '../../types/domain';
import { estimateTextTokens } from './requestTokenEstimation';

export type AssistantMemoryLineDecision = {
  text: string;
  estimatedTokens: number;
  status: 'kept' | 'dropped_budget';
};

export type AssistantRequestMemoryPlan = {
  selectedLines: string[];
  estimatedTokens: number;
  maxTokens: number | null;
  status: 'empty' | 'within_budget' | 'trimmed_budget';
  entries: AssistantMemoryLineDecision[];
};

export type InheritedMemorySource = {
  id: string;
  memory: PersonaMemorySettings;
};

const MAX_RELEVANT_NON_CORE_LINES = 6;

const ALWAYS_ON_MEMORY_PATTERN =
  /核心|长期规则|固定规则|原则|称呼|叫我|关系|我们是|必须|永远|总是|边界|禁区|约定|暗号|沟通风格|回答风格|不要提/i;

const MEMORY_MATCH_STOP_TOKENS = new Set([
  '用户',
  '助手',
  '我们',
  '你们',
  '他们',
  '自己',
  '这个',
  '那个',
  '什么',
  '怎么',
  '为什么',
  '现在',
  '今天',
  '已经',
  '还是',
  '就是',
  '觉得',
  '比较',
  '一个',
  '如果',
  '时候',
  '因为',
  '所以',
  '但是',
  '而且',
  '真的',
  '可能',
  '需要',
  '可以',
  '希望',
  '想要',
  '喜欢',
  '偏好',
  '习惯',
  '不要',
  '记得',
  '关于'
]);

function normalizeMemoryMatchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()【】\[\]{}<>《》]/g, '');
}

function buildMemoryMatchTokens(input: string): Set<string> {
  const tokens = new Set<string>();
  const lowered = input.toLowerCase();

  for (const match of lowered.matchAll(/[a-z0-9][a-z0-9._-]+/g)) {
    const token = match[0];
    if (!MEMORY_MATCH_STOP_TOKENS.has(token)) {
      tokens.add(token);
    }
  }

  const hanRuns = input.match(/[\u3400-\u9fff]+/g) ?? [];
  for (const run of hanRuns) {
    const maxSize = Math.min(4, run.length);
    for (let size = 2; size <= maxSize; size += 1) {
      for (let index = 0; index + size <= run.length; index += 1) {
        const token = run.slice(index, index + size);
        if (!MEMORY_MATCH_STOP_TOKENS.has(token)) {
          tokens.add(token);
        }
      }
    }
  }

  return tokens;
}

function shouldAlwaysKeepMemory(line: string): boolean {
  const descriptor = describeMemoryItem(line);
  return descriptor?.tier === 'core' || ALWAYS_ON_MEMORY_PATTERN.test(line);
}

function memoryRelevanceScore(line: string, queryText: string, queryTokens: Set<string>): number {
  const normalizedQuery = normalizeMemoryMatchText(queryText);
  const normalizedLine = normalizeMemoryMatchText(line);

  if (normalizedQuery.length >= 2 && normalizedLine.includes(normalizedQuery)) {
    return 100;
  }

  const lineTokens = buildMemoryMatchTokens(line);
  let score = 0;

  for (const token of queryTokens) {
    if (!lineTokens.has(token)) continue;

    if (/^[a-z0-9]/i.test(token)) {
      score += token.length >= 5 ? 6 : 3;
    } else if (token.length >= 4) {
      score += 6;
    } else if (token.length === 3) {
      score += 4;
    } else {
      score += 2;
    }
  }

  return score;
}

function selectQueryRelevantMemoryLines(lines: string[], queryText: string | undefined): string[] {
  const weightedLines = buildWeightedMemoryLines(lines);

  // Keep the old behavior for callers that have not opted into query-aware selection yet.
  if (queryText === undefined) {
    return weightedLines;
  }

  const queryTokens = buildMemoryMatchTokens(queryText);
  const alwaysOnLines: string[] = [];
  const relevantLines: Array<{ line: string; score: number; index: number }> = [];

  weightedLines.forEach((line, index) => {
    if (shouldAlwaysKeepMemory(line)) {
      alwaysOnLines.push(line);
      return;
    }

    const score = memoryRelevanceScore(line, queryText, queryTokens);
    if (score > 0) {
      relevantLines.push({ line, score, index });
    }
  });

  relevantLines.sort((left, right) =>
    right.score - left.score || left.index - right.index
  );

  return [
    ...alwaysOnLines,
    ...relevantLines
      .slice(0, MAX_RELEVANT_NON_CORE_LINES)
      .map((entry) => entry.line)
  ];
}

function estimateMemorySegmentTokens(lines: string[]) {
  if (!lines.length) return 0;
  return estimateTextTokens([
    '以下是当前协作者可调用的长期记忆线索。',
    '核心记忆可作为稳定背景；其余线索只在与当前话题相关时自然使用。不要逐条复述，也不要把它们说成系统说明。',
    ...buildMemorySegmentLines(lines)
  ].join('\n'));
}

export function resolveRequestMemoryPlan(args: {
  memory?: PersonaMemorySettings;
  inheritedMemorySources?: InheritedMemorySource[];
  maxTokens: number | null;
  queryText?: string;
}): AssistantRequestMemoryPlan {
  const inheritedLines = args.memory?.inheritGlobal === false
    ? []
    : (args.inheritedMemorySources ?? [])
        .filter((source) => !args.memory?.excludedGlobalIds.includes(source.id))
        .filter((source) => source.memory.excludeFromGlobal !== true)
        .flatMap((source) => source.memory.personalMemories);
  const weightedLines = selectQueryRelevantMemoryLines([
    ...(args.memory?.personalMemories ?? []),
    ...inheritedLines
  ].map((line) => line.trim()).filter(Boolean), args.queryText);
  if (!weightedLines.length) {
    return {
      selectedLines: [],
      estimatedTokens: 0,
      maxTokens: args.maxTokens,
      status: 'empty',
      entries: []
    };
  }

  if (args.maxTokens === null) {
    return {
      selectedLines: weightedLines,
      estimatedTokens: estimateMemorySegmentTokens(weightedLines),
      maxTokens: null,
      status: 'within_budget',
      entries: weightedLines.map((text) => ({
        text,
        estimatedTokens: estimateTextTokens(text),
        status: 'kept'
      }))
    };
  }

  const selectedLines: string[] = [];
  const entries: AssistantMemoryLineDecision[] = [];

  for (const line of weightedLines) {
    const nextLines = [...selectedLines, line];
    const nextTokens = estimateMemorySegmentTokens(nextLines);
    if (selectedLines.length > 0 && nextTokens > args.maxTokens) {
      entries.push({
        text: line,
        estimatedTokens: estimateTextTokens(line),
        status: 'dropped_budget'
      });
      continue;
    }

    selectedLines.push(line);
    entries.push({
      text: line,
      estimatedTokens: estimateTextTokens(line),
      status: 'kept'
    });
  }

  return {
    selectedLines,
    estimatedTokens: estimateMemorySegmentTokens(selectedLines),
    maxTokens: args.maxTokens,
    status: entries.some((entry) => entry.status === 'dropped_budget') ? 'trimmed_budget' : 'within_budget',
    entries
  };
}
