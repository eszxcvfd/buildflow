import nestjs from '@buildflow/eslint-config/nestjs';

export default [
  ...nestjs,
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', 'src/generated/**'],
  },
];
