import nextjs from '@buildflow/eslint-config/nextjs';

export default [
  ...nextjs,
  {
    ignores: ['.next/', 'node_modules/', 'out/'],
  },
];
