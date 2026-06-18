import type { TreeScene, Vec3 } from '../types/tree';

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateTreeScene(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return fail('scene must be an object');
  }

  const scene = value as unknown as TreeScene;
  const arrays: Array<[keyof TreeScene, number]> = [
    ['branches', 1],
    ['leafClusters', 1],
    ['runes', 1],
    ['crystals', 1],
    ['details', 1],
  ];

  for (const [key, minLength] of arrays) {
    const item = scene[key];
    if (!Array.isArray(item) || item.length < minLength) {
      return fail(`${key} must contain at least ${minLength} item`);
    }
  }

  for (const [index, branch] of scene.branches.entries()) {
    const path = `branches[${index}]`;
    if (!isNonEmptyString(branch.id)) return fail(`${path}.id must be non-empty`);
    if (!isFiniteVec3(branch.start)) return fail(`${path}.start.${badVec3Field(branch.start)} must be finite`);
    if (!isFiniteVec3(branch.end)) return fail(`${path}.end.${badVec3Field(branch.end)} must be finite`);
    if (!isPositiveFinite(branch.radiusStart)) return fail(`${path}.radiusStart must be positive`);
    if (!isPositiveFinite(branch.radiusEnd)) return fail(`${path}.radiusEnd must be positive`);
    if (!Number.isInteger(branch.level) || branch.level < 0) return fail(`${path}.level must be a non-negative integer`);
  }

  const interactiveIds = new Set<string>();
  for (const [collectionName, collection] of [
    ['leafClusters', scene.leafClusters],
    ['runes', scene.runes],
    ['crystals', scene.crystals],
  ] as const) {
    for (const [index, item] of collection.entries()) {
      if (!isNonEmptyString(item.id)) return fail(`${collectionName}[${index}].id must be non-empty`);
      if (interactiveIds.has(item.id)) return fail(`duplicate interactive id: ${item.id}`);
      interactiveIds.add(item.id);
      if (!isFiniteVec3(item.position)) return fail(`${collectionName}[${index}].position must be finite`);
    }
  }

  for (const [index, detail] of scene.details.entries()) {
    if (!interactiveIds.has(detail.id)) return fail(`details[${index}].id does not match an interactive object`);
    if (!isNonEmptyString(detail.title)) return fail(`details[${index}].title must be non-empty`);
    if (!Number.isFinite(detail.energy) || detail.energy < 0 || detail.energy > 1) {
      return fail(`details[${index}].energy must be between 0 and 1`);
    }
  }

  if (!isRecord(scene.palette) || !isNonEmptyString(scene.palette.glow)) {
    return fail('palette.glow must be present');
  }

  return { ok: true };
}

function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFiniteVec3(value: unknown): value is Vec3 {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    typeof value.z === 'number' &&
    Number.isFinite(value.z)
  );
}

function badVec3Field(value: unknown): string {
  if (!isRecord(value)) return 'value';
  for (const field of ['x', 'y', 'z'] as const) {
    if (typeof value[field] !== 'number' || !Number.isFinite(value[field])) {
      return field;
    }
  }
  return 'value';
}
