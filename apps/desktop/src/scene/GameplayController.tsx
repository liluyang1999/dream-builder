import { useFrame } from '@react-three/fiber';
import { type RefObject, useEffect, useRef } from 'react';
import {
  CHECKPOINT_PLACEMENTS,
  LIGHT_SEED_PLACEMENTS,
  type LightSeedPlacement,
  MEMORY_FRAGMENT_PLACEMENT,
  RESTORATION_NODE,
} from '../game/forestLayout';
import type { GameProgress } from '../game/gameProgress';
import { useAppStore } from '../state/store';
import type { PlayerApi } from './PlayerController';

const REVEAL_DISTANCE = 2.6;
const SEED_INTERACTION_DISTANCE = 1.8;
const MEMORY_INTERACTION_DISTANCE = 1.8;
const NODE_INTERACTION_DISTANCE = 1.55;
const CHECKPOINT_ACTIVATION_DISTANCE = 1.35;

export function GameplayController({
  playerApiRef,
  inputLocked,
}: { playerApiRef: RefObject<PlayerApi | null>; inputLocked: boolean }) {
  const dispatch = useAppStore((state) => state.dispatchGameProgress);
  const setPrompt = useAppStore((state) => state.setInteractionPrompt);
  const openMemory = useAppStore((state) => state.openMemory);
  const lastInteractionRevision = useRef(0);
  const lastPrompt = useRef<string | null>(null);

  useEffect(
    () => () => {
      setPrompt(null);
    },
    [setPrompt],
  );

  useFrame(() => {
    if (inputLocked || document.querySelector('[aria-modal="true"]')) {
      if (lastPrompt.current !== null) {
        lastPrompt.current = null;
        setPrompt(null);
      }
      return;
    }
    const snapshot = playerApiRef.current?.getSnapshot();
    if (!snapshot) return;

    const progressBeforeReveal = useAppStore.getState().progress;
    for (const placement of LIGHT_SEED_PLACEMENTS) {
      if (
        progressBeforeReveal.seeds[placement.id] === 'hidden' &&
        distance(snapshot.position, placement.position) <= REVEAL_DISTANCE
      ) {
        dispatch({ type: 'reveal-seed', id: placement.id });
      }
    }

    const nearbyCheckpoint = findNearestCheckpoint(snapshot.position);
    if (
      nearbyCheckpoint &&
      nearbyCheckpoint.id !== useAppStore.getState().progress.activeCheckpoint
    ) {
      dispatch({ type: 'activate-checkpoint', id: nearbyCheckpoint.id });
    }

    // Zustand transitions are synchronous. Read the committed snapshot again
    // so a seed revealed in this frame can immediately produce an E prompt.
    const progress = useAppStore.getState().progress;
    const nearbySeed = findNearbyRevealedSeed(snapshot.position, progress.seeds);
    const memoryDistance = distance(snapshot.position, MEMORY_FRAGMENT_PLACEMENT.position);
    const nearbyMemory = memoryDistance <= MEMORY_INTERACTION_DISTANCE;
    const nodeDistance = distance(snapshot.position, RESTORATION_NODE.position);
    let prompt: string | null = null;
    if (nearbySeed) {
      prompt = `按 E 收集「${nearbySeed.label}」`;
    } else if (nearbyMemory) {
      prompt = progress.memoriesRead.includes(MEMORY_FRAGMENT_PLACEMENT.id)
        ? `按 E 重温「${MEMORY_FRAGMENT_PLACEMENT.label}」`
        : `按 E 聆听「${MEMORY_FRAGMENT_PLACEMENT.label}」`;
    } else if (nodeDistance <= NODE_INTERACTION_DISTANCE) {
      if (progress.nodeState === 'ready') {
        prompt = '按 E 注入光种，开始净化仪式';
      } else if (progress.nodeState === 'dormant') {
        prompt = `还需要 ${LIGHT_SEED_PLACEMENTS.length - progress.collectedCount} 枚光种`;
      } else if (progress.nodeState === 'cleansing') {
        prompt = '净化仪式正在等待你的方向回应';
      } else {
        prompt = '遗迹节点已经恢复，智慧树正在回应';
      }
    }
    if (prompt !== lastPrompt.current) {
      lastPrompt.current = prompt;
      setPrompt(prompt);
    }

    if (snapshot.interactionRevision === lastInteractionRevision.current) return;
    lastInteractionRevision.current = snapshot.interactionRevision;
    if (nearbySeed) {
      dispatch({ type: 'collect-seed', id: nearbySeed.id });
    } else if (nearbyMemory) {
      dispatch({ type: 'read-memory', id: MEMORY_FRAGMENT_PLACEMENT.id });
      openMemory(MEMORY_FRAGMENT_PLACEMENT.id);
    } else if (nodeDistance <= NODE_INTERACTION_DISTANCE && progress.nodeState === 'ready') {
      dispatch({ type: 'begin-cleansing' });
    }
  });

  return null;
}

function findNearestCheckpoint(position: { x: number; z: number }) {
  let nearest: (typeof CHECKPOINT_PLACEMENTS)[number] | null = null;
  let nearestDistance = CHECKPOINT_ACTIVATION_DISTANCE;
  for (const placement of CHECKPOINT_PLACEMENTS) {
    const candidateDistance = distance(position, placement.position);
    if (candidateDistance <= nearestDistance) {
      nearest = placement;
      nearestDistance = candidateDistance;
    }
  }
  return nearest;
}

function findNearbyRevealedSeed(
  position: { x: number; z: number },
  seedStates: GameProgress['seeds'],
): LightSeedPlacement | null {
  let nearest: LightSeedPlacement | null = null;
  let nearestDistance = SEED_INTERACTION_DISTANCE;
  for (const placement of LIGHT_SEED_PLACEMENTS) {
    if (seedStates[placement.id] !== 'revealed') continue;
    const candidateDistance = distance(position, placement.position);
    if (candidateDistance <= nearestDistance) {
      nearest = placement;
      nearestDistance = candidateDistance;
    }
  }
  return nearest;
}

function distance(left: { x: number; z: number }, right: { x: number; z: number }): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}
