module.exports = {
  root: true,
  extends: ['@buildflow/eslint-config/nestjs.cjs'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
};
