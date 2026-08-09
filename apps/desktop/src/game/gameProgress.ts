export const GAME_PROGRESS_VERSION = 2 as const;
export const LIGHT_SEED_IDS = ['home-glow', 'mushroom-glow', 'creek-glow'] as const;
export const FOREST_CHECKPOINT_IDS = [
  'spawn',
  'treeClearing',
  'mushroomSlope',
  'creek',
  'ruinGate',
] as const;
export const MEMORY_FRAGMENT_IDS = ['mossbound-echo'] as const;

export type LightSeedId = (typeof LIGHT_SEED_IDS)[number];
export type ForestCheckpointId = (typeof FOREST_CHECKPOINT_IDS)[number];
export type MemoryFragmentId = (typeof MEMORY_FRAGMENT_IDS)[number];
export type LightSeedState = 'hidden' | 'revealed' | 'collected';
export type RestorationNodeState = 'dormant' | 'ready' | 'cleansing' | 'restored';

export interface GameProgress {
  version: typeof GAME_PROGRESS_VERSION;
  seeds: Record<LightSeedId, LightSeedState>;
  collectedCount: number;
  nodeState: RestorationNodeState;
  treeStage: 0 | 1;
  gateUnlocked: boolean;
  activeCheckpoint: ForestCheckpointId;
  memoriesRead: MemoryFragmentId[];
}

export type GameProgressAction =
  | { type: 'reveal-seed'; id: LightSeedId }
  | { type: 'collect-seed'; id: LightSeedId }
  | { type: 'activate-checkpoint'; id: ForestCheckpointId }
  | { type: 'read-memory'; id: MemoryFragmentId }
  | { type: 'begin-cleansing' }
  | { type: 'cancel-cleansing' }
  | { type: 'complete-cleansing' }
  | { type: 'reset' };

export const INITIAL_GAME_PROGRESS: GameProgress = createInitialGameProgress();

export function createInitialGameProgress(): GameProgress {
  return {
    version: GAME_PROGRESS_VERSION,
    seeds: {
      'home-glow': 'hidden',
      'mushroom-glow': 'hidden',
      'creek-glow': 'hidden',
    },
    collectedCount: 0,
    nodeState: 'dormant',
    treeStage: 0,
    gateUnlocked: false,
    activeCheckpoint: 'spawn',
    memoriesRead: [],
  };
}

export function reduceGameProgress(
  progress: GameProgress,
  action: GameProgressAction,
): GameProgress {
  switch (action.type) {
    case 'reveal-seed': {
      if (progress.seeds[action.id] !== 'hidden') return progress;
      return {
        ...progress,
        seeds: { ...progress.seeds, [action.id]: 'revealed' },
      };
    }
    case 'collect-seed': {
      if (progress.seeds[action.id] !== 'revealed') return progress;
      const seeds = { ...progress.seeds, [action.id]: 'collected' as const };
      const collectedCount = countCollectedSeeds(seeds);
      return {
        ...progress,
        seeds,
        collectedCount,
        nodeState: collectedCount === LIGHT_SEED_IDS.length ? 'ready' : 'dormant',
      };
    }
    case 'activate-checkpoint':
      return progress.activeCheckpoint === action.id
        ? progress
        : { ...progress, activeCheckpoint: action.id };
    case 'read-memory':
      return progress.memoriesRead.includes(action.id)
        ? progress
        : { ...progress, memoriesRead: [...progress.memoriesRead, action.id] };
    case 'begin-cleansing':
      if (progress.nodeState !== 'ready') return progress;
      return { ...progress, nodeState: 'cleansing' };
    case 'cancel-cleansing':
      if (progress.nodeState !== 'cleansing') return progress;
      return { ...progress, nodeState: 'ready' };
    case 'complete-cleansing':
      if (progress.nodeState !== 'cleansing') return progress;
      return { ...progress, nodeState: 'restored', treeStage: 1, gateUnlocked: true };
    case 'reset':
      return createInitialGameProgress();
  }
}

export function parseStoredGameProgress(raw: string): GameProgress | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const core = parseProgressCore(value);
    if (!core) return null;

    if (value.version === 1) {
      if (core.nodeState === 'cleansing') return null;
      return {
        version: GAME_PROGRESS_VERSION,
        ...core,
        activeCheckpoint: 'spawn',
        memoriesRead: [],
      };
    }

    if (
      value.version !== GAME_PROGRESS_VERSION ||
      !isForestCheckpointId(value.activeCheckpoint) ||
      !Array.isArray(value.memoriesRead)
    ) {
      return null;
    }

    const memoriesRead: MemoryFragmentId[] = [];
    for (const id of value.memoriesRead) {
      if (!isMemoryFragmentId(id) || memoriesRead.includes(id)) return null;
      memoriesRead.push(id);
    }

    return {
      version: GAME_PROGRESS_VERSION,
      ...core,
      activeCheckpoint: value.activeCheckpoint,
      memoriesRead,
    };
  } catch {
    return null;
  }
}

type ProgressCore = Pick<
  GameProgress,
  'seeds' | 'collectedCount' | 'nodeState' | 'treeStage' | 'gateUnlocked'
>;

function parseProgressCore(value: Record<string, unknown>): ProgressCore | null {
  if (!isRecord(value.seeds)) return null;

  const seeds = {} as Record<LightSeedId, LightSeedState>;
  for (const id of LIGHT_SEED_IDS) {
    const seedState = value.seeds[id];
    if (!isLightSeedState(seedState)) return null;
    seeds[id] = seedState;
  }

  const collectedCount = countCollectedSeeds(seeds);
  if (value.collectedCount !== collectedCount || !isRestorationNodeState(value.nodeState)) {
    return null;
  }

  const restored = value.nodeState === 'restored';
  const ready = value.nodeState === 'ready';
  const cleansing = value.nodeState === 'cleansing';
  if (collectedCount < LIGHT_SEED_IDS.length && value.nodeState !== 'dormant') return null;
  if (collectedCount === LIGHT_SEED_IDS.length && !ready && !cleansing && !restored) return null;
  if (value.treeStage !== (restored ? 1 : 0) || value.gateUnlocked !== restored) return null;

  return {
    seeds,
    collectedCount,
    nodeState: value.nodeState,
    treeStage: restored ? 1 : 0,
    gateUnlocked: restored,
  };
}

function countCollectedSeeds(seeds: Record<LightSeedId, LightSeedState>): number {
  return LIGHT_SEED_IDS.filter((id) => seeds[id] === 'collected').length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLightSeedState(value: unknown): value is LightSeedState {
  return value === 'hidden' || value === 'revealed' || value === 'collected';
}

function isRestorationNodeState(value: unknown): value is RestorationNodeState {
  return value === 'dormant' || value === 'ready' || value === 'cleansing' || value === 'restored';
}

function isForestCheckpointId(value: unknown): value is ForestCheckpointId {
  return typeof value === 'string' && FOREST_CHECKPOINT_IDS.some((id) => id === value);
}

function isMemoryFragmentId(value: unknown): value is MemoryFragmentId {
  return typeof value === 'string' && MEMORY_FRAGMENT_IDS.some((id) => id === value);
}
