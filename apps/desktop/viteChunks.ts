const normalizeModuleId = (id: string) => id.replaceAll('\\', '/');

/**
 * Keep the deferred 3D runtime cacheable without folding optional exporters
 * into the scene's startup path.
 */
export function sceneVendorChunk(id: string): string | undefined {
  const moduleId = normalizeModuleId(id);

  if (moduleId.includes('/node_modules/three/build/')) {
    return 'three-engine';
  }

  if (
    moduleId.includes('/node_modules/postprocessing/') ||
    moduleId.includes('/node_modules/@react-three/postprocessing/')
  ) {
    return 'three-effects';
  }

  if (
    moduleId.includes('/node_modules/@react-three/fiber/') ||
    moduleId.includes('/node_modules/@react-three/drei/') ||
    moduleId.includes('/node_modules/three-stdlib/') ||
    moduleId.includes('/node_modules/maath/')
  ) {
    return 'react-three-runtime';
  }

  return undefined;
}
