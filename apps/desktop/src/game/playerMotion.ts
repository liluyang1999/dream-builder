import type { PlayerInputIntent } from './playerInput';

export interface Vec2 {
  x: number;
  z: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleObstacle {
  id: string;
  kind: 'circle';
  center: Vec2;
  radius: number;
}

export interface RectObstacle {
  id: string;
  kind: 'rect';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type WorldObstacle = CircleObstacle | RectObstacle;

export interface CollisionWorld {
  bounds: WorldBounds;
  obstacles: readonly WorldObstacle[];
}

export interface PlayerMotionState {
  position: Vec2;
  velocity: Vec2;
  facing: number;
  radius: number;
}

export interface PlayerMotionConfig {
  walkSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  deceleration: number;
  maxFrameDelta: number;
  maxSubstepDistance: number;
}

export const DEFAULT_PLAYER_MOTION_CONFIG: PlayerMotionConfig = {
  walkSpeed: 2.8,
  sprintSpeed: 4.7,
  acceleration: 18,
  deceleration: 24,
  maxFrameDelta: 0.1,
  maxSubstepDistance: 0.08,
};

export function createPlayerMotionState(position: Vec2, radius = 0.34): PlayerMotionState {
  return {
    position: { ...position },
    velocity: { x: 0, z: 0 },
    facing: Math.PI,
    radius,
  };
}

/** Convert forward/right intent to a unit-length direction on the XZ plane. */
export function movementVectorFromIntent(intent: PlayerInputIntent, cameraForward: Vec2): Vec2 {
  const forward = normalize(cameraForward, { x: 0, z: -1 });
  const right = { x: -forward.z, z: forward.x };
  const world = {
    x: forward.x * intent.forward + right.x * intent.right,
    z: forward.z * intent.forward + right.z * intent.right,
  };
  return normalize(world, { x: 0, z: 0 });
}

export function stepPlayerMotion(
  state: PlayerMotionState,
  intent: PlayerInputIntent,
  cameraForward: Vec2,
  frameDelta: number,
  world: CollisionWorld,
  config: PlayerMotionConfig = DEFAULT_PLAYER_MOTION_CONFIG,
): PlayerMotionState {
  const delta = clamp(frameDelta, 0, config.maxFrameDelta);
  if (delta === 0) return state;

  const direction = movementVectorFromIntent(intent, cameraForward);
  const hasInput = direction.x !== 0 || direction.z !== 0;
  const speed = intent.sprint ? config.sprintSpeed : config.walkSpeed;
  const targetVelocity = hasInput
    ? { x: direction.x * speed, z: direction.z * speed }
    : { x: 0, z: 0 };
  let velocity = moveVectorToward(
    state.velocity,
    targetVelocity,
    (hasInput ? config.acceleration : config.deceleration) * delta,
  );

  const displacement = { x: velocity.x * delta, z: velocity.z * delta };
  const stepCount = Math.max(
    1,
    Math.ceil(
      Math.max(Math.abs(displacement.x), Math.abs(displacement.z)) / config.maxSubstepDistance,
    ),
  );
  const step = { x: displacement.x / stepCount, z: displacement.z / stepCount };
  const position = { ...state.position };

  for (let index = 0; index < stepCount; index += 1) {
    const alongX = clampToBounds({ x: position.x + step.x, z: position.z }, state.radius, world);
    if (isWalkable(alongX, state.radius, world)) {
      position.x = alongX.x;
    } else {
      velocity = { ...velocity, x: 0 };
    }

    const alongZ = clampToBounds({ x: position.x, z: position.z + step.z }, state.radius, world);
    if (isWalkable(alongZ, state.radius, world)) {
      position.z = alongZ.z;
    } else {
      velocity = { ...velocity, z: 0 };
    }
  }

  const velocityMagnitude = Math.hypot(velocity.x, velocity.z);
  return {
    position,
    velocity,
    facing: velocityMagnitude > 0.01 ? Math.atan2(velocity.x, velocity.z) : state.facing,
    radius: state.radius,
  };
}

export function isWalkable(position: Vec2, playerRadius: number, world: CollisionWorld): boolean {
  const { bounds } = world;
  if (
    position.x < bounds.minX + playerRadius ||
    position.x > bounds.maxX - playerRadius ||
    position.z < bounds.minZ + playerRadius ||
    position.z > bounds.maxZ - playerRadius
  ) {
    return false;
  }

  return world.obstacles.every((obstacle) => {
    if (obstacle.kind === 'circle') {
      const dx = position.x - obstacle.center.x;
      const dz = position.z - obstacle.center.z;
      const minimumDistance = playerRadius + obstacle.radius;
      return dx * dx + dz * dz >= minimumDistance * minimumDistance;
    }
    return !(
      position.x > obstacle.minX - playerRadius &&
      position.x < obstacle.maxX + playerRadius &&
      position.z > obstacle.minZ - playerRadius &&
      position.z < obstacle.maxZ + playerRadius
    );
  });
}

function clampToBounds(position: Vec2, playerRadius: number, world: CollisionWorld): Vec2 {
  return {
    x: clamp(position.x, world.bounds.minX + playerRadius, world.bounds.maxX - playerRadius),
    z: clamp(position.z, world.bounds.minZ + playerRadius, world.bounds.maxZ - playerRadius),
  };
}

function moveVectorToward(current: Vec2, target: Vec2, maxDelta: number): Vec2 {
  const difference = { x: target.x - current.x, z: target.z - current.z };
  const distance = Math.hypot(difference.x, difference.z);
  if (distance <= maxDelta || distance === 0) return target;
  const scale = maxDelta / distance;
  return { x: current.x + difference.x * scale, z: current.z + difference.z * scale };
}

function normalize(value: Vec2, fallback: Vec2): Vec2 {
  const length = Math.hypot(value.x, value.z);
  return length > 0.0001 ? { x: value.x / length, z: value.z / length } : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
