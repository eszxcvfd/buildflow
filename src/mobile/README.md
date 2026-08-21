# Buildflow Mobile

Thin Expo Router + React Native client.

- Status screen at `app/index.tsx` fetches `GET /api/v1/status` via typed adapter `src/api/client.ts`.
- No auth/token/credential storage.

## Runtime

Docker image runs **Expo web / Metro bundler** on port 19006 (`npm start` → `expo start --web`). This is the web preview of the Expo app, not a native iOS/Android simulator. Linux containers cannot run iOS Simulator or Android Emulator; for native testing use Expo Go or a local emulator/simulator outside Docker.

- Container URL: `http://mobile:19006` (compose internal), host: `http://localhost:19006`
- API base: `EXPO_PUBLIC_API_URL` is consumed in the **browser** (client-side fetch), so in Docker Compose it must be `http://localhost:3000` (host-bound loopback) rather than the Compose service name `http://api:3000`. The service name `api` is only reachable container-to-container (e.g., `API_INTERNAL_URL=http://api:3000` used by the web server). Local dev outside Docker also uses `http://localhost:3000`.
