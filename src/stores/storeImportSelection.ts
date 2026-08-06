import type { LocalDataDomain } from '../engines/localData';
import type { Conversation, Persona } from '../types/domain';
import type { PersistedCollectionState } from './collectionStorePersistence';
import type { PersonaMemoryDocContentPayload } from './personaMemoryReferenceDocPersistence';
import type { RuntimePayload } from './runtimeStorePersistence';
import type { PersistedSpaceState } from './spaceStorePersistence';
import type { StructuredExportSnapshot } from './storeExportPackage';

export const STORE_IMPORT_DOMAINS = [
  'chat',
  'collection',
  'persona',
  'document',
  'runtime',
  'space',
  'asset'
] as const satisfies readonly LocalDataDomain[];

export type StoreImportMode = 'merge' | 'replace';
export type StoreImportSelection = Record<(typeof STORE_IMPORT_DOMAINS)[number], boolean>;

export const DEFAULT_STORE_IMPORT_SELECTION: StoreImportSelection = {
  chat: true,
  collection: true,
  persona: true,
  document: true,
  runtime: true,
  space: true,
  asset: true
};

export function normalizeStoreImportSelection(
  selection?: Partial<StoreImportSelection> | null
): StoreImportSelection {
  return {
    ...DEFAULT_STORE_IMPORT_SELECTION,
    ...(selection ?? {})
  };
}

export function selectedStoreImportDomains(selection?: Partial<StoreImportSelection> | null) {
  const normalized = normalizeStoreImportSelection(selection);
  return STORE_IMPORT_DOMAINS.filter((domain) => normalized[domain]);
}

function mergeByKey<T>(current: T[], incoming: T[], keyOf: (entry: T) => string): T[] {
  const incomingById = new Map(incoming.map((entry) => [keyOf(entry), entry]));
  const merged = current.map((entry) => incomingById.get(keyOf(entry)) ?? entry);
  const currentIds = new Set(current.map(keyOf));
  for (const entry of incoming) {
    if (!currentIds.has(keyOf(entry))) merged.push(entry);
  }
  return merged;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  return mergeByKey(current, incoming, (entry) => entry.id);
}

function mergeConversations(current: Conversation[], incoming: Conversation[]) {
  const incomingById = new Map(incoming.map((conversation) => [conversation.id, conversation]));
  const merged = current.map((conversation) => {
    const replacement = incomingById.get(conversation.id);
    if (!replacement) return conversation;
    return {
      ...conversation,
      ...replacement,
      messages: mergeById(conversation.messages, replacement.messages)
        .sort((left, right) => left.timestamp - right.timestamp)
    };
  });
  const currentIds = new Set(current.map((conversation) => conversation.id));
  for (const conversation of incoming) {
    if (!currentIds.has(conversation.id)) merged.push(conversation);
  }
  return merged;
}

function mergeCollectionState(
  current: PersistedCollectionState,
  incoming: PersistedCollectionState
): PersistedCollectionState {
  return {
    ...current,
    ...incoming,
    cards: mergeById(current.cards, incoming.cards),
    projectFiles: mergeById(current.projectFiles, incoming.projectFiles),
    workspaceReferenceDocs: mergeById(current.workspaceReferenceDocs, incoming.workspaceReferenceDocs),
    roomProjects: mergeById(current.roomProjects, incoming.roomProjects),
    imageCards: mergeById(current.imageCards, incoming.imageCards),
    deletedBundledCardIds: Array.from(new Set([
      ...(current.deletedBundledCardIds ?? []),
      ...(incoming.deletedBundledCardIds ?? [])
    ]))
  };
}

function mergePersonaState(
  current: { personas: Persona[]; activeCollaboratorId: string | null; seededDefaultPersonaIds?: string[] },
  incoming: { personas: Persona[]; activeCollaboratorId: string | null; seededDefaultPersonaIds?: string[] }
) {
  const personas = mergeById(current.personas, incoming.personas);
  const personaIds = new Set(personas.map((persona) => persona.id));
  const preferredActiveId = incoming.activeCollaboratorId ?? current.activeCollaboratorId;
  return {
    personas,
    activeCollaboratorId: preferredActiveId && personaIds.has(preferredActiveId)
      ? preferredActiveId
      : personas[0]?.id ?? null,
    seededDefaultPersonaIds: Array.from(new Set([
      ...(current.seededDefaultPersonaIds ?? []),
      ...(incoming.seededDefaultPersonaIds ?? [])
    ]))
  };
}

function mergeRuntimeState(current: RuntimePayload, incoming: RuntimePayload): RuntimePayload {
  return {
    ...current,
    ...incoming,
    providers: mergeById(current.providers, incoming.providers),
    mcpServers: mergeById(current.mcpServers, incoming.mcpServers),
    companionConnections: mergeById(current.companionConnections, incoming.companionConnections),
    triggerRules: mergeById(current.triggerRules, incoming.triggerRules),
    toolPromptPreferences: {
      ...current.toolPromptPreferences,
      ...incoming.toolPromptPreferences
    }
  };
}

function mergeSpaceState(current: PersistedSpaceState, incoming: PersistedSpaceState): PersistedSpaceState {
  return {
    ...current,
    ...incoming,
    theme: incoming.theme ?? current.theme,
    customization: incoming.customization ?? current.customization,
    collaboratorThemes: {
      ...(current.collaboratorThemes ?? {}),
      ...(incoming.collaboratorThemes ?? {})
    },
    displayPreferences: incoming.displayPreferences ?? current.displayPreferences
  };
}

function mergeDocumentPayload(
  current: PersonaMemoryDocContentPayload | null | undefined,
  incoming: PersonaMemoryDocContentPayload | null | undefined
): PersonaMemoryDocContentPayload | null {
  if (!current && !incoming) return null;
  return {
    version: 1,
    docs: {
      ...(current?.docs ?? {}),
      ...(incoming?.docs ?? {})
    }
  };
}


export function selectStructuredExportSnapshotDomains(
  current: Required<StructuredExportSnapshot>,
  incoming: Required<StructuredExportSnapshot>,
  selection: StoreImportSelection
): Required<StructuredExportSnapshot> {
  const canFullyReplaceDocuments = selection.persona && selection.collection;
  const canFullyReplaceAssets = selection.chat && selection.collection && selection.persona && selection.space;
  return {
    chatState: selection.chat ? incoming.chatState : current.chatState,
    collectionState: selection.collection ? incoming.collectionState : current.collectionState,
    personaState: selection.persona ? incoming.personaState : current.personaState,
    personaMemoryDocContent: selection.document
      ? canFullyReplaceDocuments
        ? incoming.personaMemoryDocContent
        : mergeDocumentPayload(current.personaMemoryDocContent, incoming.personaMemoryDocContent)
      : current.personaMemoryDocContent,
    runtimeState: selection.runtime ? incoming.runtimeState : current.runtimeState,
    spaceState: selection.space ? incoming.spaceState : current.spaceState,
    assetEntries: selection.asset
      ? canFullyReplaceAssets
        ? incoming.assetEntries
        : mergeByKey(current.assetEntries, incoming.assetEntries, (entry) => entry.meta.id)
      : current.assetEntries
  };
}

export function mergeStructuredExportSnapshots(
  current: Required<StructuredExportSnapshot>,
  incoming: Required<StructuredExportSnapshot>,
  selection: StoreImportSelection
): Required<StructuredExportSnapshot> {
  const conversations = selection.chat
    ? mergeConversations(current.chatState.conversations, incoming.chatState.conversations)
    : current.chatState.conversations;
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const preferredConversationId = incoming.chatState.activeConversationId ?? current.chatState.activeConversationId;

  return {
    chatState: selection.chat
      ? {
          ...current.chatState,
          ...incoming.chatState,
          conversations,
          activeConversationId: preferredConversationId && conversationIds.has(preferredConversationId)
            ? preferredConversationId
            : conversations[0]?.id ?? null
        }
      : current.chatState,
    collectionState: selection.collection
      ? mergeCollectionState(current.collectionState, incoming.collectionState)
      : current.collectionState,
    personaState: selection.persona
      ? mergePersonaState(current.personaState, incoming.personaState)
      : current.personaState,
    personaMemoryDocContent: selection.document
      ? mergeDocumentPayload(current.personaMemoryDocContent, incoming.personaMemoryDocContent)
      : current.personaMemoryDocContent,
    runtimeState: selection.runtime
      ? mergeRuntimeState(current.runtimeState, incoming.runtimeState)
      : current.runtimeState,
    spaceState: selection.space
      ? mergeSpaceState(current.spaceState, incoming.spaceState)
      : current.spaceState,
    assetEntries: selection.asset
      ? mergeByKey(current.assetEntries, incoming.assetEntries, (entry) => entry.meta.id)
      : current.assetEntries
  };
}
