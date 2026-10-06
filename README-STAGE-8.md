# AURA FieldOS — Stage 8: Manager Dashboard & Performance Intelligence

Built on top of Stage 7.

## What this stage adds

- Live, company/RLS-scoped dashboard KPIs instead of demo numbers.
- Monthly won revenue.
- Qualified/current CRM lead count.
- Monthly completed visits.
- Open pipeline value.
- Twelve-week won-revenue trend.
- Current team field-work state from active work sessions and started visits.
- Priority task queue.
- Recent lead movement.
- Pending expense count surfaced on the dashboard.
- Role-aware dashboard copy and scope. Managers/admins see the scope allowed by RLS; salespeople naturally see their own records.
- Server-side data retrieval in `lib/dashboard/queries.ts`; the client dashboard only renders the data it receives.

## Architecture

`app/page.tsx` authenticates and loads the profile, then fetches dashboard data server-side. `AppShell` receives a serializable `DashboardData` object and passes it to the presentation component.

No company ID, employee scope, revenue value, or role is trusted from the browser. Existing PostgreSQL RLS policies remain the source of truth for what each role can read.

## Migration

No new database migration is required for Stage 8. It consumes the existing Stage 1–7 schema.

Run all previous migrations in order:

1. `0001_auth_roles.sql`
2. `0002_company_employee_teams.sql`
3. `0003_crm.sql`
4. `0004_field_work.sql`
5. `0005_maps_trips.sql`
6. `0006_finance_compensation.sql`

## Verification

Run locally:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

The build environment used to prepare this archive did not have package-registry access, so a dependency-complete Next.js build was not claimed here.
