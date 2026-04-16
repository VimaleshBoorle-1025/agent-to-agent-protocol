module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@aap/crypto$': '<rootDir>/../crypto/src/index.ts',
    '^@aap/intent-compiler$': '<rootDir>/../intent-compiler/src/index.ts',
  },
};
