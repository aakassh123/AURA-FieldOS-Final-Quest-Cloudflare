# AURA FieldOS — Cumulative Production Build

AURA FieldOS is a field-sales operating system covering CRM, assignments, attendance, work sessions, GPS-verified visits, trips, expenses, compensation, commissions, dashboards, reports, notifications, native mobile field work and the AURA Quest reward engine.

This archive is cumulative through Stage 12 and includes the Stage 13 Quest & Rewards product layer.

## Core stack

- Next.js 16 + TypeScript + React
- Tailwind CSS + shadcn-style component patterns
- Supabase Auth + PostgreSQL + RLS + Realtime
- PostGIS-ready field/location architecture
- MapLibre + OpenStreetMap
- Expo/React Native mobile app
- Cloudflare Workers deployment using the documented OpenNext adapter path for the existing Next.js application

## Database

Run Supabase migrations `0001` through `0010` in order.

## Important docs

- `README-STAGE-12.md` — production hardening and Cloudflare deployment
- `README-STAGE-13.md` — AURA Quest & Rewards design and security
- `mobile/README.md` — native mobile setup

## Production principle

The browser is not trusted for company identity, role, commission, XP or physical reward claims. Sensitive business mutations are validated server-side and protected by PostgreSQL RLS and security-definer functions where transactional behavior is required.
