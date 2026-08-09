// @vitest-environment node

import { type ViteDevServer, createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { sceneVendorChunk } from '../../viteChunks';

const desktopRoot = decodeURIComponent(new URL('../..', import.meta.url).pathname).replace(
  /^\/([A-Za-z]:\/)/,
  '$1',
);

describe('Vite development transform', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      root: desktopRoot,
      configFile: `${desktopRoot}/vite.config.ts`,
      optimizeDeps: { noDiscovery: true },
      server: { middlewareMode: true },
    });
  });

  afterAll(async () => {
    await server.close();
  }, 30_000);

  test('downlevels standard decorators before serving application modules', async () => {
    const transformed = await server.transformRequest('/src/ipc/treeApi.ts');

    expect(transformed).not.toBeNull();
    expect(transformed?.code).not.toMatch(/^\s*@(measure|logged)\s*$/m);
  });

  test('serves HUD copy with the active Liquid Glass foreground token', async () => {
    const cssModule = await server.ssrLoadModule('/src/styles.css?raw');
    const css = cssModule.default;

    expect(typeof css).toBe('string');
    expect(css).not.toMatch(/color:\s*rgba\(\s*244\s*,\s*239\s*,\s*226/);
    expect(css.match(/color:\s*var\(--lg-fg\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(css).toMatch(
      /\.app-root\[data-lg-theme="light"\]\s*\{[^}]*--product-heading:\s*#17261f;[^}]*--product-highlight:\s*#704900;/s,
    );
    expect(css).toMatch(
      /\.game-menu__panel h1,[\s\S]*?\.credits-overlay__panel h2\s*\{[^}]*color:\s*var\(--product-heading\);/,
    );
    expect(css).toMatch(
      /\.app-root\[data-lg-theme="light"\]\.app-root--high-contrast \.lg-panel,[\s\S]*?border-color:\s*rgba\(8, 24, 17, 0\.72\);/,
    );
    expect(css).toMatch(
      /\.app-root--high-contrast \.game-menu__footer,[\s\S]*?\.app-root--high-contrast \.settings-overlay__footer p,[\s\S]*?opacity:\s*1;/,
    );
  });

  test('keeps HUD utility overlays positioned above the shared glass surface rule', async () => {
    const cssModule = await server.ssrLoadModule('/src/styles.css?raw');
    const css = cssModule.default;

    expect(css).toMatch(
      /\.hud\s*>\s*\.hud__help\s*\{[^}]*position:\s*absolute;[^}]*max-height:[^;}]+;[^}]*overflow:\s*auto;/s,
    );
    expect(css).toMatch(
      /\.hud\s*>\s*\.performance-panel\s*\{[^}]*position:\s*absolute;[^}]*max-height:[^;}]+;[^}]*overflow:\s*auto;/s,
    );
  });
});

describe('production scene chunking', () => {
  test.each([
    ['three/build/three.module.js', 'three-engine'],
    ['postprocessing/build/index.js', 'three-effects'],
    ['@react-three/postprocessing/dist/index.js', 'three-effects'],
    ['@react-three/fiber/dist/react-three-fiber.esm.js', 'react-three-runtime'],
    ['@react-three/drei/core/OrbitControls.js', 'react-three-runtime'],
    ['three-stdlib/controls/OrbitControls.js', 'react-three-runtime'],
    ['maath/dist/index.js', 'react-three-runtime'],
  ])('places %s in %s', (packagePath, expectedChunk) => {
    const moduleId = `D:\\repo\\node_modules\\.pnpm\\fixture\\node_modules\\${packagePath}`;

    expect(sceneVendorChunk(moduleId)).toBe(expectedChunk);
  });

  test('keeps optional exporters and application modules on their natural lazy boundaries', () => {
    expect(
      sceneVendorChunk(
        'D:/repo/node_modules/.pnpm/three@0.170.0/node_modules/three/examples/jsm/exporters/GLTFExporter.js',
      ),
    ).toBeUndefined();
    expect(sceneVendorChunk('D:/repo/apps/desktop/src/scene/SceneCanvas.tsx')).toBeUndefined();
  });
});
