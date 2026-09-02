# @buildflow/mobile

Expo SDK 57 + Expo Router technical foundation only.

- React Native `0.86.3`, TypeScript strict.
- Android baseline: `minSdkVersion = 29` (Android 10+ per [`ADR-005`](../../docs/architecture/adr/ADR-005-mobile-platform.md)).
- TanStack Query provider in `app/_layout.tsx`.
- No business screens yet (no auth, no work-order screens).

Copy `.env.example` to `.env.local` before running. For Expo Go on a physical
device, set `EXPO_PUBLIC_API_URL` to the development machine's LAN IPv4 instead
of `localhost`; both devices must use the same network.

Validate:

```sh
pnpm --filter @buildflow/mobile typecheck
pnpm --filter @buildflow/mobile validate    # expo-doctor
```
