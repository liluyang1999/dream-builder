import { useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FOREST_WORLD } from '../game/forestLayout';
import { combinePlayerIntents, sampleStandardGamepad, usePlayerInput } from '../game/playerInput';
import { type Vec2, createPlayerMotionState, stepPlayerMotion } from '../game/playerMotion';
import { damp } from './sceneHelpers';

export interface PlayerApi {
  reset(position?: Vec2): void;
  getSnapshot(): { position: Vec2; interactionRevision: number };
}

interface OrbitLike {
  target: THREE.Vector3;
  update(): void;
}

export const PLAYER_CAMERA_OFFSET: readonly [number, number, number] = [4.1, 3.35, 5.35];
export const PLAYER_CAMERA_TARGET_HEIGHT = 1.08;

export function PlayerController({
  apiRef,
  reducedMotion,
  respawnPosition,
  inputLocked,
}: {
  apiRef: RefObject<PlayerApi | null>;
  reducedMotion: boolean;
  respawnPosition: Vec2;
  inputLocked: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const avatarRef = useRef<THREE.Group>(null);
  const inputRef = usePlayerInput(inputLocked);
  const respawnPositionRef = useRef(respawnPosition);
  respawnPositionRef.current = respawnPosition;
  const motionRef = useRef(createPlayerMotionState(respawnPosition));
  const snapshotRef = useRef({
    position: { ...respawnPosition } as Vec2,
    interactionRevision: 0,
  });
  const resetRequestedRef = useRef(true);
  const resetPositionOverrideRef = useRef<Vec2 | null>(null);
  const gamepadInteractionRevisionRef = useRef(0);
  const gamepadInteractPressedRef = useRef(false);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitLike | null;
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const cameraOffset = useMemo(() => new THREE.Vector3(...PLAYER_CAMERA_OFFSET), []);

  useEffect(() => {
    apiRef.current = {
      reset(position) {
        resetPositionOverrideRef.current = position ? { ...position } : null;
        resetRequestedRef.current = true;
      },
      getSnapshot() {
        const snapshot = snapshotRef.current;
        return {
          position: { ...snapshot.position },
          interactionRevision: snapshot.interactionRevision,
        };
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  useEffect(() => {
    if (!inputLocked) return;
    motionRef.current = {
      ...motionRef.current,
      velocity: { x: 0, z: 0 },
    };
  }, [inputLocked]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (resetRequestedRef.current) {
      const checkpoint = resetPositionOverrideRef.current ?? respawnPositionRef.current;
      resetPositionOverrideRef.current = null;
      motionRef.current = createPlayerMotionState(checkpoint);
      snapshotRef.current = {
        position: { ...checkpoint },
        interactionRevision: inputRef.current.interactionRevision,
      };
      group.position.set(checkpoint.x, 0, checkpoint.z);
      group.rotation.y = motionRef.current.facing;
      camera.position.set(
        checkpoint.x + cameraOffset.x,
        cameraOffset.y,
        checkpoint.z + cameraOffset.z,
      );
      if (controls) {
        controls.target.set(checkpoint.x, PLAYER_CAMERA_TARGET_HEIGHT, checkpoint.z);
        controls.update();
      }
      resetRequestedRef.current = false;
      return;
    }

    if (inputLocked || document.querySelector('[aria-modal="true"]')) return;

    camera.getWorldDirection(cameraDirection);
    const gamepad = sampleStandardGamepad(findPrimaryGamepad());
    if (gamepad.interactPressed && !gamepadInteractPressedRef.current) {
      gamepadInteractionRevisionRef.current += 1;
    }
    gamepadInteractPressedRef.current = gamepad.interactPressed;
    const input = {
      ...combinePlayerIntents(inputRef.current, gamepad),
      interactionRevision:
        inputRef.current.interactionRevision + gamepadInteractionRevisionRef.current,
    };
    const previous = motionRef.current;
    const next = stepPlayerMotion(
      previous,
      input,
      { x: cameraDirection.x, z: cameraDirection.z },
      delta,
      FOREST_WORLD,
    );
    motionRef.current = next;
    snapshotRef.current = {
      position: { ...next.position },
      interactionRevision: input.interactionRevision,
    };

    const dx = next.position.x - previous.position.x;
    const dz = next.position.z - previous.position.z;
    group.position.set(next.position.x, 0, next.position.z);
    group.rotation.y = reducedMotion
      ? next.facing
      : dampAngle(group.rotation.y, next.facing, 14, delta);

    if (dx !== 0 || dz !== 0) {
      camera.position.x += dx;
      camera.position.z += dz;
      if (controls) {
        controls.target.x += dx;
        controls.target.z += dz;
        controls.target.y = PLAYER_CAMERA_TARGET_HEIGHT;
        controls.update();
      }
    }

    const avatar = avatarRef.current;
    if (avatar) {
      const speed = Math.hypot(next.velocity.x, next.velocity.z);
      const bobTarget =
        !reducedMotion && speed > 0.15 ? Math.sin(state.clock.elapsedTime * 10.5) * 0.035 : 0;
      avatar.position.y = damp(avatar.position.y, bobTarget, 14, delta);
    }
  });

  return (
    <group ref={groupRef} name="forest-keeper">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color="#071018" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <group ref={avatarRef}>
        <mesh position={[0, 0.52, 0]} castShadow>
          <coneGeometry args={[0.32, 0.78, 7]} />
          <meshStandardMaterial color="#e6a85e" roughness={0.76} />
        </mesh>
        <mesh position={[0, 0.98, 0]} castShadow>
          <sphereGeometry args={[0.245, 12, 8]} />
          <meshStandardMaterial color="#f1d7ad" roughness={0.68} />
        </mesh>
        <mesh position={[0, 1.17, 0.015]} rotation={[0.08, 0, 0]} castShadow>
          <coneGeometry args={[0.34, 0.52, 7]} />
          <meshStandardMaterial color="#347c68" roughness={0.8} />
        </mesh>
        <mesh position={[-0.09, 1.01, -0.22]}>
          <sphereGeometry args={[0.024, 8, 6]} />
          <meshBasicMaterial color="#20312f" />
        </mesh>
        <mesh position={[0.09, 1.01, -0.22]}>
          <sphereGeometry args={[0.024, 8, 6]} />
          <meshBasicMaterial color="#20312f" />
        </mesh>
        <pointLight color="#7df0bd" intensity={0.7} distance={1.8} position={[0, 0.72, 0.15]} />
      </group>
    </group>
  );
}

function findPrimaryGamepad(): Gamepad | null {
  if (typeof navigator.getGamepads !== 'function') return null;
  for (const gamepad of navigator.getGamepads()) {
    if (gamepad?.connected) return gamepad;
  }
  return null;
}

function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  const shortest = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + shortest * (1 - Math.exp(-lambda * delta));
}
