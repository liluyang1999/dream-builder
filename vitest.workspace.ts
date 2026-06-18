import { defineWorkspace } from 'vitest/config';

// Single source of truth for which packages Vitest discovers across the monorepo.
// Each package keeps its own `test` block (environment, includes) in its Vite config.
export default defineWorkspace(['apps/*', 'packages/*']);
