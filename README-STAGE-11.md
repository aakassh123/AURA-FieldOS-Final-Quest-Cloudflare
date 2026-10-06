# AURA FieldOS — Stage 11

## Native Mobile App — Expo / React Native

Stage 11 adds the native field-sales companion app on top of Stages 1–10.

### Product decision

The mobile app is **salesman-first**. Managers/admins keep the richer configuration/reporting experience on web. The native app focuses on the actions that benefit from device capabilities:

- Check in / check out
- Start/end authorized work sessions
- Background location during an active work session
- Customer visit verification
- Tasks
- Push notifications
- Offline retry queue for field telemetry

### Architecture

```text
Expo / React Native
       ↓
Supabase JS client
       ↓
Postgres + RLS
       ↓
Existing AURA tables
```

The mobile client never receives the Supabase service-role key. It uses the existing publishable key and relies on RLS for authorization.

### Background location

Background location is deliberately tied to an explicit work session. The salesperson starts work, grants the required OS permission, and then AURA starts the native location task. Ending the work session stops the task.

This is both a product/UX decision and a privacy boundary: location should support field work, not become silent employee surveillance.

Expo's current location documentation notes that background location is subject to OS constraints and requires native configuration/development builds; Android and iOS behavior differ when the app is terminated.

### Offline queue

`expo-sqlite` stores a small local retry queue for:

- Work-session location points
- Trip points
- Attendance writes

The queue is not a second database. It is only a durable retry buffer. Successful sync removes the item.

### Authentication

The mobile client follows Supabase's current React Native pattern: `@supabase/supabase-js`, React Native URL polyfill, persistent local storage, token auto-refresh, and `detectSessionInUrl: false`.

### Push notifications

The app registers Expo push tokens in `device_push_tokens`.

Durable notification:

```text
business event
   ↓
public.notifications
   ↓
Supabase Database Webhook
   ↓
send-notification Edge Function
   ↓
Expo Push Service
   ↓
phone
```

The service-role key is only used inside the Edge Function.

### Migration

Run:

```text
0008_mobile_devices.sql
```

after `0001` through `0007`.

### Mobile setup

```bash
cd mobile
npm install
npx expo start
```

For real background location, create an Expo development build / EAS build. Expo documents that background location is not supported by Expo Go for the native background task path.

### Push setup

Deploy:

```text
supabase/functions/send-notification/index.ts
```

Then configure a Supabase Database Webhook for `INSERT` on `public.notifications` to invoke the function.

### Verification checklist

1. Sign in with an existing AURA account.
2. Confirm the linked employee appears.
3. Start work and grant location permission.
4. Confirm an attendance record and active work session are created.
5. Confirm background location task starts.
6. End work and confirm the task stops.
7. Open a planned visit and test geofence verification.
8. Disable network temporarily and create telemetry; confirm it enters the local retry queue.
9. Restore network and refresh Home; confirm queued records sync.
10. Enable push notifications and register the device token.
11. Create a notification for the user and confirm the database webhook/Edge Function delivers a push notification.

### Known limitations

- OS background execution is never an absolute guarantee.
- Full offline-first conflict resolution for every domain is not implemented in Stage 11.
- Push delivery needs the webhook/Edge Function deployment step.
- Native mobile focuses on field sales; admin/manager configuration remains web-first.
