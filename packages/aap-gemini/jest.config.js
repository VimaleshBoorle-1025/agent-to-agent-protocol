module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^aap-sdk$': '<rootDir>/../sdk-js/src/index.ts',
    '^@aap/crypto$': '<rootDir>/../crypto/src/index.ts',
    '^@aap/intent-compiler$': '<rootDir>/../intent-compiler/src/index.ts',
  },
};
