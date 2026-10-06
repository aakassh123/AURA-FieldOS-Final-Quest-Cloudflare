# AURA FieldOS — Stage 6: Maps + Trips + Distance

Stage 6 adds the operational map layer and measurable field travel:

**employee location → live map → customer pins → trip → GPS points → Haversine distance → trip history**

## Included

- MapLibre-based live operational map
- OpenStreetMap raster tiles with attribution
- Employee latest known work-session positions
- Customer GPS pins
- Role-scoped map visibility through existing RLS
- Trip start/end with GPS
- Trip location tracking while the trip page remains open
- Trip points and server/database distance accumulation
- Trip history with employee, status and distance
- New `trips` and `trip_points` tables
- Company isolation and cross-company relationship triggers

## Migration

Run after Stages 1–5:

```text
supabase/migrations/0005_maps_trips.sql
```

## Local run

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Map architecture

The UI uses MapLibre GL JS with OpenStreetMap raster tiles. The application does not trust the browser for company visibility; Supabase RLS remains the authorization boundary.

## Location limitation

This stage still uses browser geolocation. Trip points are recorded while the trip page is active and permission is granted. True background GPS, native geofencing and resilient offline queues remain part of the later Expo/React Native stage.

## Distance calculation

The database `haversine_meters()` function calculates segment distance between consecutive trip points. The server then accumulates those segments into `trips.distance_m`.

This is an operational travel metric. It is deliberately not yet converted into petrol reimbursement or salary/commission amounts; that belongs to the Finance/Compensation stage.
