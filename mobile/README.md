# AURA FieldOS — Stage 11 Mobile

Native field-sales companion built with Expo / React Native. This stage is intentionally a separate `mobile/` app while sharing the same Supabase backend as the Next.js web application.

## Included

- Supabase email/password authentication
- Mobile-first Home / Tasks / Visits / Profile navigation
- Native foreground GPS
- Native background location task during an authorized active work session
- Customer visit GPS + geofence verification using the existing `haversine_meters` function
- SQLite-backed offline mutation queue
- SQLite-backed location queue for background capture
- Network-aware sync when connectivity returns
- Expo push notification token registration
- Existing Stage 10 notification records remain the source of truth
- Permission transparency in Profile

## Why this architecture

The browser app remains the management/control plane. The mobile app is the field execution plane. Both use the same Supabase database and RLS policies.

```text
Next.js Web → Management / CRM / Reports
                         ↓
                    Supabase
                         ↑
Expo Mobile → Tasks / Visits / GPS / Offline
```

## Setup

From `mobile/`:

```bash
npm install
npx expo install
```

Create `.env` from `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Then:

```bash
npx expo start
```

For background location and remote push notifications, use a development build rather than relying on Expo Go. Expo's current documentation states that background location requires native configuration and a development build on iOS; Android background/foreground service behavior also requires a native build. Remote push notifications likewise require a development build on Android from modern Expo SDKs.

## Stage 11 database migration

Run:

```text
supabase/migrations/0008_mobile_devices.sql
```

after `0001` → `0007`.

## Background location behavior

Location capture starts only after the employee starts an explicit work session and grants the necessary permissions. It stops when the work session ends. The app queues captured points locally first and syncs them to `work_session_location_points` when network connectivity is available.

The operating system can still suspend/terminate background work. This is a platform limitation, not something the app can guarantee away.

## Push notifications

The app registers an Expo Push Token in `mobile_devices`. Stage 10 database notifications remain the authoritative notification records. A later server worker can read new notifications and send them through Expo Push Service.

## Verification checklist

1. Sign in with a real AURA employee account.
2. Allow foreground location.
3. Check in.
4. Start work.
5. Grant background location if prompted.
6. Move the device/emulator and confirm location points are queued.
7. End work and confirm queued points sync.
8. Start a scheduled visit with a configured customer GPS pin.
9. Verify distance/geofence result.
10. Test offline mode by disabling network, performing a supported mutation, restoring network, and confirming sync.

## Important product/privacy behavior

AURA should never present background location as continuous employee surveillance. The mobile app explains why location is needed, limits tracking to authorized field-work sessions, and makes permission state visible.
