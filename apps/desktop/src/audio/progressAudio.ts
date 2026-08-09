import type { GameProgress } from '../game/gameProgress';

export type ForestAudioCue =
  | 'checkpoint'
  | 'memory'
  | 'ritual'
  | 'ritual-error'
  | 'ritual-step'
  | 'seed'
  | 'restore';

type ProgressAudioSnapshot = Pick<
  GameProgress,
  'activeCheckpoint' | 'collectedCount' | 'memoriesRead' | 'nodeState'
>;

export function cuesForProgressChange(
  previous: ProgressAudioSnapshot,
  current: ProgressAudioSnapshot,
): ForestAudioCue[] {
  const cues: ForestAudioCue[] = [];
  if (current.collectedCount > previous.collectedCount) cues.push('seed');
  if (current.activeCheckpoint !== previous.activeCheckpoint) cues.push('checkpoint');
  if (current.memoriesRead.length > previous.memoriesRead.length) cues.push('memory');
  if (current.nodeState === 'cleansing' && previous.nodeState !== 'cleansing') cues.push('ritual');
  if (current.nodeState === 'restored' && previous.nodeState !== 'restored') cues.push('restore');
  return cues;
}
