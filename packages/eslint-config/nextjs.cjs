module.exports = {
  extends: [
    './base.cjs',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'next/core-web-vitals',
  ],
  settings: {
    react: { version: 'detect' },
  },
};
