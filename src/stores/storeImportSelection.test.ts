import { describe, expect, it } from 'vitest';
import type { StructuredExportSnapshot } from './storeExportPackage';
import { normalizeRuntimePayload } from './runtimeStorePersistence';
import {
  DEFAULT_STORE_IMPORT_SELECTION,
  mergeStructuredExportSnapshots,
  normalizeStoreImportSelection,
  selectStructuredExportSnapshotDomains,
  selectedStoreImportDomains
} from './storeImportSelection';

function snapshot(overrides: Partial<Required<StructuredExportSnapshot>> = {}): Required<StructuredExportSnapshot> {
  return {
    chatState: { conversations: [], activeConversationId: null },
    collectionState: {
      cards: [], projectFiles: [], workspaceReferenceDocs: [], roomProjects: [], imageCards: []
    },
    personaState: { personas: [], activeCollaboratorId: null },
    personaMemoryDocContent: { version: 1, docs: {} },
    runtimeState: normalizeRuntimePayload(),
    spaceState: {} as Required<StructuredExportSnapshot>['spaceState'],
    assetEntries: [],
    ...overrides
  };
}

describe('storeImportSelection', () => {
  it('normalizes an incomplete selection and lists only enabled domains', () => {
    const selection = normalizeStoreImportSelection({ chat: false, runtime: false });
    expect(selection.chat).toBe(false);
    expect(selection.asset).toBe(true);
    expect(selectedStoreImportDomains(selection)).not.toContain('chat');
    expect(selectedStoreImportDomains(selection)).not.toContain('runtime');
  });

  it('merges selected chat rows while retaining current-only conversations and messages', () => {
    const current = snapshot({
      chatState: {
        activeConversationId: 'old',
        conversations: [{
          id: 'old', title: 'Current', collaboratorId: 'p1', pinnedAt: null, updatedAt: 2,
          messages: [
            { id: 'm1', role: 'user', content: 'old', timestamp: 1 },
            { id: 'm2', role: 'assistant', content: 'keep', timestamp: 2 }
          ]
        }]
      }
    });
    const incoming = snapshot({
      chatState: {
        activeConversationId: 'old',
        conversations: [{
          id: 'old', title: 'Backup', collaboratorId: 'p1', pinnedAt: null, updatedAt: 3,
          messages: [
            { id: 'm1', role: 'user', content: 'updated', timestamp: 1 },
            { id: 'm3', role: 'assistant', content: 'new', timestamp: 3 }
          ]
        }]
      }
    });

    const merged = mergeStructuredExportSnapshots(current, incoming, DEFAULT_STORE_IMPORT_SELECTION);
    expect(merged.chatState.conversations[0].title).toBe('Backup');
    expect(merged.chatState.conversations[0].messages.map((message) => message.id)).toEqual(['m1', 'm2', 'm3']);
    expect(merged.chatState.conversations[0].messages[0].content).toBe('updated');
  });

  it('uses current unselected domains during partial replacement', () => {
    const current = snapshot({
      personaMemoryDocContent: { version: 1, docs: { current: 'keep' } }
    });
    const incoming = snapshot({
      personaMemoryDocContent: { version: 1, docs: { backup: 'add' } }
    });
    const selected = selectStructuredExportSnapshotDomains(current, incoming, {
      ...DEFAULT_STORE_IMPORT_SELECTION,
      persona: false,
      collection: false,
      chat: false,
      runtime: false,
      space: false,
      asset: false
    });
    expect(selected.personaState).toBe(current.personaState);
    expect(selected.personaMemoryDocContent).toEqual({
      version: 1,
      docs: { current: 'keep', backup: 'add' }
    });
  });

  it('leaves unselected domains untouched', () => {
    const current = snapshot({ personaMemoryDocContent: { version: 1, docs: { old: 'keep' } } });
    const incoming = snapshot({ personaMemoryDocContent: { version: 1, docs: { new: 'replace' } } });
    const merged = mergeStructuredExportSnapshots(current, incoming, {
      ...DEFAULT_STORE_IMPORT_SELECTION,
      document: false
    });
    expect(merged.personaMemoryDocContent).toEqual({ version: 1, docs: { old: 'keep' } });
  });
});
