import { defineConfig } from 'vite-plus';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  fmt: {
    singleQuote: true,
    ignorePatterns: [
      'src/database/migrations/**',
      'bun.lock',
      '.claude/**',
      '.agents/**',
      '.codex/**',
    ],
  },
  lint: {
    ignorePatterns: [
      'dist/**',
      'coverage/**',
      'src/database/schema/**',
      'src/database/migrations/**',
    ],
    options: { typeAware: true, typeCheck: true, maxWarnings: 0 },
    rules: { 'typescript/no-floating-promises': 'error' },
  },
  staged: { '*.{js,mjs,ts,json,yml,yaml,md}': 'vp check --fix' },
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/database/schema/**', 'src/**/*.spec.ts', 'src/main.ts'],
      reporter: ['text', 'lcov'],
    },
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
