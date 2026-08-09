import {
  CHECKPOINT_PLACEMENTS,
  LIGHT_SEED_PLACEMENTS,
  MEMORY_FRAGMENT_PLACEMENT,
  RESTORATION_NODE,
} from '../game/forestLayout';
import { useAppStore } from '../state/store';
import { CheckpointMarker } from './CheckpointMarker';
import { LightSeed } from './LightSeed';
import { MemoryFragment } from './MemoryFragment';
import { RestorationNode } from './RestorationNode';

export function GameplayWorld({ reducedMotion }: { reducedMotion: boolean }) {
  const progress = useAppStore((state) => state.progress);

  return (
    <group name="gameplay-world">
      {LIGHT_SEED_PLACEMENTS.map((placement) => (
        <LightSeed
          key={placement.id}
          position={placement.position}
          state={progress.seeds[placement.id]}
          reducedMotion={reducedMotion}
        />
      ))}
      {CHECKPOINT_PLACEMENTS.map((placement) => (
        <CheckpointMarker
          key={placement.id}
          position={placement.position}
          active={progress.activeCheckpoint === placement.id}
          reducedMotion={reducedMotion}
        />
      ))}
      <MemoryFragment
        position={MEMORY_FRAGMENT_PLACEMENT.position}
        read={progress.memoriesRead.includes(MEMORY_FRAGMENT_PLACEMENT.id)}
        reducedMotion={reducedMotion}
      />
      <RestorationNode
        position={RESTORATION_NODE.position}
        state={progress.nodeState}
        reducedMotion={reducedMotion}
      />
      {progress.nodeState === 'restored' ? (
        <pointLight color="#7df0bd" intensity={4.2} distance={15} position={[0, 2.4, 0]} />
      ) : null}
    </group>
  );
}
