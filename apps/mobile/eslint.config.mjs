import reactNative from '@buildflow/eslint-config/react-native';

export default [
  ...reactNative,
  {
    ignores: ['.expo/', 'node_modules/', 'dist/'],
  },
];
