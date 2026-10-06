# AURA FieldOS — Stage 9

## Reports & Analytics

Stage 9 adds a real reporting layer on top of Stages 1–8 without changing the database schema.

### Included
- Date-range reporting (from/to)
- Sales performance by employee
- Won revenue and won deals
- Open pipeline value
- Lead funnel by pipeline stage
- Completed visits and geofence verification
- Trip count and total travel distance
- Finance snapshot for Super Admin / Company Admin / HR & Accounts
- CSV export from a protected Next.js route
- Reports navigation entry
- All queries use the authenticated Supabase server client, so existing PostgreSQL RLS remains authoritative

### Run

1. Keep migrations 0001 through 0006 applied.
2. Copy `.env.example` to `.env.local` and set Supabase URL + publishable key.
3. `npm install`
4. `npm run typecheck`
5. `npm run build`
6. `npm run dev`

### Notes
- No new migration is required.
- Reports are operational analytics, not a replacement for statutory accounting/payroll.
- CSV export is private and requires authentication.
- Finance metrics are intentionally role-gated in the reporting service.
