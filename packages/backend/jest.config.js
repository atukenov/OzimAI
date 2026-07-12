/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleNameMapper: {
    '^@ozimai/shared$': '<rootDir>/../shared/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  // Jest doesn't load .env on its own — without this, ANTHROPIC_API_KEY only
  // ever exists inside the running app (via NestJS ConfigModule), so the
  // live-Anthropic block in guardrails.spec.ts silently self-skips even with
  // a real key configured. This makes `process.env.ANTHROPIC_API_KEY` match
  // what the app actually sees.
  setupFiles: ['<rootDir>/test/support/load-env.ts'],
};
