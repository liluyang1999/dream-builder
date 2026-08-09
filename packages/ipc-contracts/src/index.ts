/**
 * IPC contracts — the single source of truth for the Rust ⇄ TypeScript wire
 * format.
 *
 * Teaching points:
 * - Schemas are defined once with zod; static types are *derived* via
 *   `z.infer`, so the runtime validator and the compile-time types can never
 *   drift apart.
 * - The boundary (anything crossing from Rust/IPC) is validated at runtime; the
 *   typed core downstream then trusts its own types.
 * - `superRefine` encodes cross-field invariants (unique ids, references).
 */
import { z } from 'zod';

const finite = z.number().finite();

export const vec3Schema = z.object({
  x: finite,
  y: finite,
  z: finite,
});
export type Vec3 = z.infer<typeof vec3Schema>;

export const branchSegmentSchema = z.object({
  id: z.string().min(1),
  start: vec3Schema,
  end: vec3Schema,
  radiusStart: finite.positive(),
  radiusEnd: finite.positive(),
  twist: finite,
  level: z.number().int().nonnegative(),
});
export type BranchSegment = z.infer<typeof branchSegmentSchema>;

export const leafClusterSchema = z.object({
  id: z.string().min(1),
  position: vec3Schema,
  radius: finite.positive(),
  density: z.number().int().nonnegative(),
  hue: finite,
});
export type LeafCluster = z.infer<typeof leafClusterSchema>;

export const runeMarkSchema = z.object({
  id: z.string().min(1),
  position: vec3Schema,
  normal: vec3Schema,
  glyph: z.string().min(1),
  intensity: finite,
});
export type RuneMark = z.infer<typeof runeMarkSchema>;

export const crystalClusterSchema = z.object({
  id: z.string().min(1),
  position: vec3Schema,
  scale: finite.positive(),
  hue: finite,
});
export type CrystalCluster = z.infer<typeof crystalClusterSchema>;

export const detailKindSchema = z.enum(['rune', 'crystal', 'leaf']);
export type DetailKind = z.infer<typeof detailKindSchema>;

export const detailInfoSchema = z.object({
  id: z.string().min(1),
  kind: detailKindSchema,
  title: z.string().min(1),
  description: z.string(),
  energy: finite.min(0).max(1),
});
export type DetailInfo = z.infer<typeof detailInfoSchema>;

export const treePaletteSchema = z.object({
  bark: z.string().min(1),
  leaves: z.string().min(1),
  glow: z.string().min(1),
  crystal: z.string().min(1),
  backgroundTop: z.string().min(1),
  backgroundBottom: z.string().min(1),
});
export type TreePalette = z.infer<typeof treePaletteSchema>;

export const treeSceneSchema = z
  .object({
    seed: z.number().int().nonnegative(),
    branches: z.array(branchSegmentSchema).min(1),
    leafClusters: z.array(leafClusterSchema).min(1),
    runes: z.array(runeMarkSchema).min(1),
    crystals: z.array(crystalClusterSchema).min(1),
    details: z.array(detailInfoSchema).min(1),
    palette: treePaletteSchema,
  })
  .superRefine((scene, ctx) => {
    const interactiveIds = new Set<string>();
    for (const item of [...scene.leafClusters, ...scene.runes, ...scene.crystals]) {
      if (interactiveIds.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate interactive id: ${item.id}`,
        });
      }
      interactiveIds.add(item.id);
    }
    for (const detail of scene.details) {
      if (!interactiveIds.has(detail.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `detail '${detail.id}' has no matching interactive object`,
        });
      }
    }
  });
export type TreeScene = z.infer<typeof treeSceneSchema>;

export const magicPulseSchema = z.object({
  id: z.string().min(1),
  center: vec3Schema,
  radius: finite,
  strength: finite,
});
export type MagicPulse = z.infer<typeof magicPulseSchema>;

export const magicFieldSchema = z.object({
  tick: z.number().int().nonnegative(),
  wind: vec3Schema,
  pulses: z.array(magicPulseSchema),
});
export type MagicField = z.infer<typeof magicFieldSchema>;

/** Structured error every fallible command rejects with. */
export const appErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type AppError = z.infer<typeof appErrorSchema>;

export const themeSchema = z.enum(['auto', 'light', 'dark']);
export type Theme = z.infer<typeof themeSchema>;

export const graphicsQualitySchema = z.enum(['low', 'balanced', 'high']);
export type GraphicsQuality = z.infer<typeof graphicsQualitySchema>;

export const textScaleSchema = z.enum(['normal', 'large']);
export type TextScale = z.infer<typeof textScaleSchema>;

const percentageSchema = z.number().int().min(0).max(100);

export const settingsSchema = z.object({
  seed: z.number().int().nonnegative(),
  theme: themeSchema,
  reducedMotion: z.boolean(),
  graphicsQuality: graphicsQualitySchema.default('balanced'),
  masterVolume: percentageSchema.default(80),
  musicVolume: percentageSchema.default(55),
  effectsVolume: percentageSchema.default(75),
  cameraSensitivity: z.number().int().min(50).max(150).default(100),
  highContrast: z.boolean().default(false),
  textScale: textScaleSchema.default('normal'),
  showHints: z.boolean().default(true),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  seed: 424242,
  theme: 'auto',
  reducedMotion: false,
  graphicsQuality: 'balanced',
  masterVolume: 80,
  musicVolume: 55,
  effectsVolume: 75,
  cameraSensitivity: 100,
  highContrast: false,
  textScale: 'normal',
  showHints: true,
};

/** A discriminated-union `Result`, used at the validation boundary. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/** Validate an unknown value against a schema into a `ParseResult`. */
export function parseWith<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown,
): ParseResult<z.output<Schema>> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const first = result.error.issues[0];
  const path = first?.path.join('.') ?? '';
  const reason = path ? `${path}: ${first?.message}` : (first?.message ?? 'invalid value');
  return { ok: false, reason };
}
