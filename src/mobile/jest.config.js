module.exports = {
  preset: 'jest-expo',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // JOB-SRS-005 (#45) T0 — fix infra có sẵn (F16): preset jest-expo mặc định
  // `transformIgnorePatterns: ['/node_modules/(?!((jest-)?react-native|...))']`
  // không khớp layout pnpm (`node_modules/.pnpm/<pkg>/node_modules/<pkg>/...`):
  // đoạn `.pnpm/<pkg>/node_modules/` không nằm trong allowlist nên mọi file
  // ESM dưới `.pnpm` (thí dụ `@react-native/js-polyfills/error-guard.js`,
  // `expo-modules-core/build/web/index.web.js`) bị bỏ qua transform → 8/8
  // suite fail parse. Override chèn `(.pnpm/[^/]+/node_modules/)?` trước mọi
  // nhánh allowlist (giữ nguyên semantics mặc định, chỉ mở thêm đường pnpm).
  // Không đổi dependency, không đụng nghiệp vụ.
  transformIgnorePatterns: [
    '/node_modules/(?!((.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
};
