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
};
