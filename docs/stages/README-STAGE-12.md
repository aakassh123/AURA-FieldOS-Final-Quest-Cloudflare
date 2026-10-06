# AURA FieldOS — Stage 12: Production Hardening + Cloudflare

Stage 12 is the cumulative web + mobile application from Stages 1–11, hardened for production. Stage 13's Quest & Reward Engine is included in this archive as the next product layer.

## Deployment architecture

```text
GitHub
  ↓
Cloudflare Workers (Next.js via OpenNext)
  ├─ WAF / DNS / CDN / custom domain
  └─ AURA FieldOS web
        ↓
Supabase
  ├─ Auth
  ├─ PostgreSQL + RLS + PostGIS
  ├─ Storage
  └─ Realtime

Mobile app → Supabase directly with the same RLS-secured backend
```

Cloudflare currently recommends vinext for new Next.js-on-Workers projects, but this project already uses Next.js 16 and an established App Router codebase. This archive deliberately uses the documented OpenNext adapter path to avoid a broad framework migration; Cloudflare documents OpenNext as the path for maintaining existing OpenNext applications. Before production release, run the Cloudflare adapter preview and compatibility checks. 

## Included
- PostgreSQL audit logs and protected trigger writes
- operational indexes
- security headers and disabled `X-Powered-By`
- `/api/health`
- error and not-found boundaries
- Cloudflare Workers/OpenNext configuration (`wrangler.jsonc`, `open-next.config.ts`)
- Cloudflare preview/deploy scripts
- production environment template
- Expo EAS production configuration
- AURA Quest reward engine: XP, levels, streaks, company-configured reward catalog, reward rules, one-time reward claims and redemption codes
- task type classification so a company can attach rewards to meaningful work such as MEETING or VISIT

## Database migrations

Run migrations `0001` through `0010` in order.

## Cloudflare deployment

1. Push this repository to GitHub.
2. In Cloudflare Workers, create/import the project using Workers Builds.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Workers Build variables/secrets.
4. Use `npm install` as the install step and `npm run deploy` as the deploy command when deploying from a CI runner that invokes Wrangler directly. If using Cloudflare's detected Next.js workflow, keep the generated build/deploy settings aligned with the OpenNext configuration in this repository.
5. For local verification, run `npm run preview`. This executes the built app in the Cloudflare Workers runtime instead of only using Node's Next.js dev server.
6. Attach the production custom domain in Cloudflare and keep Supabase Auth redirect URLs aligned with the final domain.
7. Verify `/api/health`, authentication, RLS, CRM, GPS visit verification, realtime notifications, reports, exports and Quest rewards.

Do not commit Cloudflare API tokens, Supabase service-role keys, or other secrets.

## Supabase production checklist
- Run Security Advisor and resolve findings
- Confirm RLS on every exposed table
- Enable SSL enforcement
- Configure network restrictions as appropriate
- Enable MFA for the Supabase organization
- Configure email confirmation and production SMTP
- Configure backups/PITR according to recovery objectives
- Apply migrations through the team's migration workflow
- Confirm Auth Site URL and redirect URLs use the Cloudflare production domain

## Quest & Reward design

Rewards are not browser-generated points. A server-side PostgreSQL function completes the task/visit and atomically records XP, streak progress and a reward claim when an active company rule matches.

Example seeded reward:

> **Refreshment Choice** — choose one small reward: a cold drink up to ₹20 OR 2 samosa.

A manager can later change the catalog/rules and can use stock limits to control the budget. The system does not reward unsafe driving or GPS manipulation; verified field work and meaningful task completion are the qualifying events.

## Mobile release

Configure EAS project ID and production environment variables, then use the production profile. Use a physical Android/iOS device for location and notification testing.

## Important non-goals

This stage does not claim that Cloudflare, Supabase or Expo resources have already been provisioned. Infrastructure credentials and dashboard configuration remain deployment-time responsibilities.
