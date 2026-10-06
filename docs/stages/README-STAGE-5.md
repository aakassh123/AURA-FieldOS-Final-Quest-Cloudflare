# AURA FieldOS — Stage 5: Field Work

Stage 5 connects the CRM to the field-sales workflow:

**attendance → work session → location pings → customer visit → GPS/geofence verification → visit outcome → follow-up**

## Included

- GPS-backed attendance check-in/check-out
- Work sessions with start/end location
- Periodic browser location pings while a session is open
- Customer GPS pin capture from the Customers screen
- Customer visit planning
- Customer visit GPS/geofence verification
- Visit outcome and next follow-up
- Field-work dashboard / My Work
- Attendance history
- Visit queue and detail pages
- PostgreSQL RLS and company-isolation guards
- Database Haversine distance calculation

## Migration

Run after Stages 1–4:

```text
supabase/migrations/0004_field_work.sql
```

## Local run

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Important browser-location limitation

Stage 5 intentionally uses browser geolocation for the MVP. A normal browser tab is not a reliable replacement for native background GPS. Location pings only happen while the work-session page is active and permitted by the browser.

For production-grade background tracking, push notifications and stronger offline behavior, the roadmap moves this capability to an Expo/React Native mobile app.

## Security model

- The browser submits coordinates, but it does not decide whether a visit is verified.
- The server reads the customer's stored coordinates and geofence radius.
- PostgreSQL calculates the distance and the server accepts the visit only when it is inside the configured radius.
- Every field-work record carries company_id and is protected by RLS.
- Employees can operate on their own field records; managers/admins can read broader company records.
- No service-role key is exposed to the browser.

## Customer GPS pin

Before a visit can be GPS-verified, set the customer's location from:

`Customers → Set customer pin`

The current MVP uses the device's current GPS position as the customer pin. A later maps stage can support moving/editing pins on a map and importing coordinates from an address.

## Timezone note

The MVP sends the browser's local calendar date for attendance. A later company-settings stage should make the company's official timezone authoritative for payroll and attendance cutoffs.
