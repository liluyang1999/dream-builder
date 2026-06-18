import { defineConfig } from 'vitest/config';

// Vitest 3 "projects" model: each workspace package supplies its own config
// (environment, includes). This is the single place test discovery is wired.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
  },
});
