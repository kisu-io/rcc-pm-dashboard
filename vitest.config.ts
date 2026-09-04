import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // Globs, not bare directory names. Setting `exclude` replaces vitest's
    // default `['**/node_modules/**', ...]`, and a bare 'node_modules' only
    // matches one at the repo root — so a nested one (a git worktree under
    // .claude/worktrees/, say) got scanned and vitest tried to run its
    // dependencies' own vendored test suites.
    exclude: ['**/node_modules/**', '**/.next/**', '**/.claude/**'],
  },
});