import base from '@buildflow/eslint-config/base';

export default [
  ...base,
  {
    ignores: ['dist/', 'node_modules/', 'src/generated/'],
  },
];
