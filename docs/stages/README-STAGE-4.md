# AURA FieldOS — Stage 4: CRM Foundation

Stage 4 builds the core sales CRM from the blueprint: pipeline stages, leads, customers, contacts, lead activity timeline and tasks.

## Database
Run `supabase/migrations/0003_crm.sql` after Stages 2 and 3 migrations.

## Product flow

`Lead → Pipeline Stage → Customer/Contact → Activity → Next Task`

Visits, deals/revenue, commission and field tracking remain later stages so the CRM stays focused.

## Security
Every CRM table has `company_id` and RLS. Salesmen are restricted to their own assigned leads/customers/tasks where applicable. Managers/admins can operate across their company. Cross-company relationship checks are enforced by database triggers.

## Local verification

```bash
npm install
npm run typecheck
npm run build
npm run dev
```
