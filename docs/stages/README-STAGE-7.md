# AURA FieldOS — Stage 7: Expenses + Salary + Commission

Stage 7 connects the field-sales workflow to money:

**field work → expense → approval → sale/deal → versioned compensation rule → commission → payout**

## Included

- Expense submission and manager/finance review queue
- Expense categories and approval status
- Sales deal/revenue bridge
- Versioned compensation rules:
  - Fixed salary
  - Per day
  - Fixed + incentive
  - Commission
  - Hybrid
- Employee compensation assignment with effective dates
- Sales targets foundation
- Commission records with rule/rate snapshots
- Payroll/payout period records
- Finance command center
- Role-aware Finance navigation
- Company isolation through PostgreSQL RLS
- Database-level relationship validation
- Commission calculation helper for won deals

## Migration

Run after Stages 1–6:

```text
supabase/migrations/0006_finance_compensation.sql
```

## Local run

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Important architecture decision

Compensation rules are **versioned**. A new commission/salary rule does not rewrite historical commission rows. Commission rows store the applied rule ID, revenue and rate as a snapshot.

## Current limitations

- Receipt files are not uploaded yet; Supabase Storage hardening belongs to the later security/storage stage.
- Payroll is a payout bridge, not a statutory payroll engine. Tax/EPF/ESI/TDS compliance is intentionally outside this MVP stage.
- Commission automation currently covers won deals recorded through AURA. More advanced target/slab/accelerator rules can be added after the core flow is stable.
