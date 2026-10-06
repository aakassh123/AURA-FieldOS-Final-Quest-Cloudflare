---
name: cloudflare
description: Guidance, best practices, and CLI commands for building, configuring, and deploying Next.js full-stack applications to Cloudflare Workers and Cloudflare Pages using @opennextjs/cloudflare and Wrangler.
---

# Cloudflare Deployment & Edge Worker Skill

This skill provides step-by-step guidance, best practices, and automated commands for building and deploying full-stack Next.js applications onto Cloudflare Workers / Cloudflare Pages using `@opennextjs/cloudflare` and `wrangler`.

---

## 1. Architecture Overview

- **Framework**: Next.js App Router (RSC, Server Actions, Route Handlers).
- **Edge Adapter**: `@opennextjs/cloudflare` transforms the Next.js production build into a Cloudflare Worker compatible bundle (`.open-next/worker.js`) and static assets (`.open-next/assets`).
- **Deployment Engine**: `wrangler` deploys the worker and static assets to Cloudflare's global edge network.

---

## 2. Key Commands

### Build for Cloudflare
```bash
# 1. Typecheck and verify environment
npm run typecheck

# 2. Build OpenNext Cloudflare bundle
npx opennextjs-cloudflare build
```

### Dry Run / Verify Assets
```bash
# Verify worker bundle and asset count without deploying
npx wrangler deploy --dry-run
```

### Local Preview on Cloudflare workerd runtime
```bash
# Preview locally in the exact Cloudflare edge environment
npx wrangler dev
```

### Deploy to Cloudflare
```bash
# 1. Login to Cloudflare account (one-time interactive login in browser)
npx wrangler login

# 2. Deploy to Cloudflare Workers
npx wrangler deploy
```

---

## 3. Configuration Files

### `wrangler.jsonc`
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "aura-fieldos",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-10-06",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "vars": {
    "NEXT_PUBLIC_SUPABASE_URL": "https://<your-project>.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "<anon-key>"
  },
  "observability": {
    "enabled": true
  }
}
```

### `open-next.config.ts`
```ts
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
```

---

## 4. Environment Variables & Secrets

For sensitive server-side keys (such as `SUPABASE_SERVICE_ROLE_KEY`):

```bash
# Upload secret securely to Cloudflare
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

For public environment variables:
Add them to the `"vars"` object inside `wrangler.jsonc`.

---

## 5. Live Monitoring & Logs

```bash
# Stream live execution logs from Cloudflare edge
npx wrangler tail aura-fieldos
```
