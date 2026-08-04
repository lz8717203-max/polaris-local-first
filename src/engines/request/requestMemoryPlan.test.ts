import { describe, expect, it } from 'vitest';
import { resolveRequestMemoryPlan } from './requestMemoryPlan';
import type { PersonaMemorySettings } from '../../types/domain';

function createMemory(overrides: Partial<PersonaMemorySettings> = {}): PersonaMemorySettings {
  return {
    inheritGlobal: true,
    crossConversationRecallEnabled: true,
    excludeFromGlobal: false,
    excludedGlobalIds: [],
    personalMemories: [],
    conversationSummaries: [],
    referenceDocs: [],
    ...overrides
  };
}

describe('resolveRequestMemoryPlan', () => {
  it('inherits memories saved by other collaborators when global memory is enabled', () => {
    const plan = resolveRequestMemoryPlan({
      memory: createMemory({
        personalMemories: ['用户 喜欢清楚边界。']
      }),
      inheritedMemorySources: [
        {
          id: 'nova',
          memory: createMemory({
            personalMemories: ['用户 偏好柔和但明确的解释。']
          })
        }
      ],
      maxTokens: null
    });

    expect(plan.selectedLines).toContain('用户 喜欢清楚边界。');
    expect(plan.selectedLines).toContain('用户 偏好柔和但明确的解释。');
  });

  it('respects disabled global inheritance and excluded collaborators', () => {
    const withoutGlobal = resolveRequestMemoryPlan({
      memory: createMemory({
        inheritGlobal: false,
        personalMemories: ['只读当前协作者。']
      }),
      inheritedMemorySources: [
        {
          id: 'nova',
          memory: createMemory({
            personalMemories: ['不应该被继承。']
          })
        }
      ],
      maxTokens: null
    });

    expect(withoutGlobal.selectedLines).toEqual(['只读当前协作者。']);

    const withExcludedSource = resolveRequestMemoryPlan({
      memory: createMemory({
        excludedGlobalIds: ['nova'],
        personalMemories: ['当前协作者记忆。']
      }),
      inheritedMemorySources: [
        {
          id: 'nova',
          memory: createMemory({
            personalMemories: ['被排除的协作者记忆。']
          })
        },
        {
          id: 'mimo',
          memory: createMemory({
            personalMemories: ['未排除的协作者记忆。']
          })
        }
      ],
      maxTokens: null
    });

    expect(withExcludedSource.selectedLines).toContain('当前协作者记忆。');
    expect(withExcludedSource.selectedLines).toContain('未排除的协作者记忆。');
    expect(withExcludedSource.selectedLines).not.toContain('被排除的协作者记忆。');
  });

  it('does not inherit memories from collaborators excluded from global memory', () => {
    const plan = resolveRequestMemoryPlan({
      memory: createMemory({
        personalMemories: ['当前协作者记忆。']
      }),
      inheritedMemorySources: [
        {
          id: 'private',
          memory: createMemory({
            excludeFromGlobal: true,
            personalMemories: ['不进入全局的协作者记忆。']
          })
        },
        {
          id: 'shared',
          memory: createMemory({
            personalMemories: ['允许进入全局的协作者记忆。']
          })
        }
      ],
      maxTokens: null
    });

    expect(plan.selectedLines).toContain('当前协作者记忆。');
    expect(plan.selectedLines).toContain('允许进入全局的协作者记忆。');
    expect(plan.selectedLines).not.toContain('不进入全局的协作者记忆。');
  });

  it('keeps core memory and query-relevant lines while dropping unrelated memories', () => {
    const plan = resolveRequestMemoryPlan({
      memory: createMemory({
        personalMemories: [
          '称呼用户为心鱼。',
          '用户喜欢茉莉味沐浴露。',
          '用户最近在研究 Polaris 记忆系统。',
          '用户不看恐怖片。'
        ]
      }),
      maxTokens: null,
      queryText: '我们继续改 Polaris 的记忆读取吧'
    });

    expect(plan.selectedLines).toContain('称呼用户为心鱼。');
    expect(plan.selectedLines).toContain('用户最近在研究 Polaris 记忆系统。');
    expect(plan.selectedLines).not.toContain('用户喜欢茉莉味沐浴露。');
    expect(plan.selectedLines).not.toContain('用户不看恐怖片。');
  });

  it('keeps only core memory for a short acknowledgement with no useful topic signal', () => {
    const plan = resolveRequestMemoryPlan({
      memory: createMemory({
        personalMemories: [
          '称呼用户为心鱼。',
          '用户喜欢茉莉味沐浴露。',
          '用户不看恐怖片。'
        ]
      }),
      maxTokens: null,
      queryText: '嗯嗯'
    });

    expect(plan.selectedLines).toEqual(['称呼用户为心鱼。']);
  });

  it('limits query-relevant non-core memories to six lines', () => {
    const plan = resolveRequestMemoryPlan({
      memory: createMemory({
        personalMemories: [
          '称呼用户为心鱼。',
          ...Array.from({ length: 9 }, (_, index) => `Polaris 记忆系统测试线索 ${index + 1}。`)
        ]
      }),
      maxTokens: null,
      queryText: '继续测试 Polaris 记忆系统'
    });

    expect(plan.selectedLines).toContain('称呼用户为心鱼。');
    expect(plan.selectedLines.filter((line) => line.includes('Polaris'))).toHaveLength(6);
  });
});
