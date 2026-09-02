# @buildflow/mobile

Expo SDK 57 + Expo Router technical foundation only.

- React Native `^0.81.0`, TypeScript strict.
- Android baseline: `minSdkVersion = 29` (Android 10+ per [`ADR-005`](../../docs/architecture/adr/ADR-005-mobile-platform.md)).
- TanStack Query provider in `app/_layout.tsx`.
- No business screens yet (no auth, no work-order screens).

Validate:

```sh
pnpm --filter @buildflow/mobile typecheck
pnpm --filter @buildflow/mobile validate    # expo-doctor
```
