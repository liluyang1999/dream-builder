export interface GameplayPerformanceSnapshot {
  seed: number;
  source: string;
  activeCheckpoint: string;
  collectedCount: number;
  memoriesRead: number;
  nodeState: string;
  treeStage: number;
}

export type GameplayPerformanceEvent =
  | { type: 'mark'; name: string }
  | { type: 'begin-phase'; name: string }
  | { type: 'end-phase'; name: string };

export function deriveGameplayPerformanceEvents(
  previous: GameplayPerformanceSnapshot | null,
  current: GameplayPerformanceSnapshot,
): GameplayPerformanceEvent[] {
  if (!previous) {
    return [
      mark(`scene-seed:${current.seed}`),
      mark(`source:${current.source}`),
      mark(`checkpoint:${current.activeCheckpoint}`),
      mark(`light-seeds:${current.collectedCount}`),
      mark(`memory-fragments:${current.memoriesRead}`),
      mark(`restoration:${current.nodeState}`),
      mark(`tree-stage:${current.treeStage}`),
      ...(current.nodeState === 'cleansing'
        ? ([{ type: 'begin-phase', name: 'cleansing' }] as const)
        : []),
    ];
  }

  const events: GameplayPerformanceEvent[] = [];
  if (previous.seed !== current.seed) events.push(mark(`scene-seed:${current.seed}`));
  if (previous.source !== current.source) events.push(mark(`source:${current.source}`));
  if (previous.activeCheckpoint !== current.activeCheckpoint) {
    events.push(mark(`checkpoint:${current.activeCheckpoint}`));
  }
  if (previous.collectedCount !== current.collectedCount) {
    events.push(mark(`light-seeds:${current.collectedCount}`));
  }
  if (previous.memoriesRead !== current.memoriesRead) {
    events.push(mark(`memory-fragments:${current.memoriesRead}`));
  }
  if (previous.nodeState !== current.nodeState) {
    if (previous.nodeState === 'cleansing') {
      events.push({ type: 'end-phase', name: 'cleansing' });
    }
    events.push(mark(`restoration:${current.nodeState}`));
    if (current.nodeState === 'cleansing') {
      events.push({ type: 'begin-phase', name: 'cleansing' });
    }
  }
  if (previous.treeStage !== current.treeStage) {
    events.push(mark(`tree-stage:${current.treeStage}`));
  }
  return events;
}

function mark(name: string): GameplayPerformanceEvent {
  return { type: 'mark', name };
}
