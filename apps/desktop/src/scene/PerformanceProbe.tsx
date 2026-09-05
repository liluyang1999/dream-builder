import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
  type GameplayPerformanceSnapshot,
  deriveGameplayPerformanceEvents,
} from '../performance/gameplayPerformanceEvents';
import { performanceCapture } from '../performance/performanceCapture';
import { useAppStore } from '../state/store';

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize?: number;
  };
}

interface DebugRendererInfo {
  UNMASKED_RENDERER_WEBGL: number;
}

export function PerformanceProbe({ renderDirectly }: { renderDirectly: boolean }) {
  const gl = useThree((state) => state.gl);
  const previousGameState = useRef<GameplayPerformanceSnapshot | null>(null);

  useEffect(() => {
    const context = gl.getContext();
    const previousAutoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    performanceCapture.setRendererInfo(
      readRendererName(context),
      typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext,
    );
    return () => {
      gl.info.autoReset = previousAutoReset;
    };
  }, [gl]);

  useFrame(() => {
    gl.info.reset();
  }, -100);

  useFrame((state, delta) => {
    // A positive priority takes over R3F's automatic render loop. Without the
    // quality-dependent composer, render explicitly before sampling this frame.
    if (renderDirectly) gl.render(state.scene, state.camera);
    performanceCapture.observeFirstSceneFrame();

    if (performanceCapture.getSnapshot().status !== 'recording') {
      previousGameState.current = null;
      return;
    }

    const gameState = observeGameState();
    recordStateChanges(previousGameState.current, gameState);
    previousGameState.current = gameState;

    const memory = performance as PerformanceWithMemory;
    const usedJSHeapSize = memory.memory?.usedJSHeapSize;
    performanceCapture.recordFrame({
      frameTimeMs: delta * 1_000,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      jsHeapBytes:
        typeof usedJSHeapSize === 'number' && Number.isFinite(usedJSHeapSize)
          ? usedJSHeapSize
          : null,
    });
  }, 2);

  return null;
}

function observeGameState(): GameplayPerformanceSnapshot {
  const state = useAppStore.getState();
  return {
    seed: state.seed,
    source: state.source ?? 'unknown',
    activeCheckpoint: state.progress.activeCheckpoint,
    collectedCount: state.progress.collectedCount,
    memoriesRead: state.progress.memoriesRead.length,
    nodeState: state.progress.nodeState,
    treeStage: state.progress.treeStage,
  };
}

function recordStateChanges(
  previous: GameplayPerformanceSnapshot | null,
  current: GameplayPerformanceSnapshot,
): void {
  for (const event of deriveGameplayPerformanceEvents(previous, current)) {
    if (event.type === 'mark') performanceCapture.mark(event.name);
    if (event.type === 'begin-phase') performanceCapture.beginPhase(event.name);
    if (event.type === 'end-phase') performanceCapture.endPhase(event.name);
  }
}

function readRendererName(context: WebGLRenderingContext | WebGL2RenderingContext): string | null {
  try {
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info') as DebugRendererInfo | null;
    const value = debugInfo
      ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}
