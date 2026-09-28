import { defineConfig } from 'vitest/config';

// Each workspace package supplies its own Vitest project config
// (environment, includes). This is the single place test discovery is wired.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
  },
});
