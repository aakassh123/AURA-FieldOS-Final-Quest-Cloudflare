# AURA FieldOS — Stage 2: Authentication & Role Foundation

## Goal
Build the first real security boundary before CRM/field modules are added.

## Included
- Supabase SSR browser/server clients using `@supabase/ssr`.
- Next.js 16 `proxy.ts` session refresh and protected-route redirect.
- Email/password login.
- Account creation with email confirmation support.
- Password reset request and password update flow.
- Auth callback for PKCE code exchange.
- Sign out.
- Initial `companies` + `profiles` schema.
- Application role enum: `SUPER_ADMIN`, `COMPANY_ADMIN`, `SALES_MANAGER`, `SALESMAN`, `HR_ACCOUNTS`.
- Database trigger to create a profile after Supabase Auth user creation.
- Initial RLS read policies and security helper functions.

## Why roles are not editable from the UI yet
A browser must never be trusted to decide its own company or privileged role. Stage 2 therefore creates the role model but intentionally provides no profile update policy. Stage 3 will add protected company/employee workflows for assigning company membership and roles.

## Setup
1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project.
3. Put the Supabase Project URL and Publishable Key into `.env.local`.
4. Run `supabase/migrations/0001_auth_roles.sql` in Supabase SQL Editor.
5. In Supabase Auth URL configuration, add your local site URL, normally `http://localhost:3000`.
6. Add `http://localhost:3000/auth/callback` to the allowed redirect URLs.
7. Run `npm install` and `npm run dev`.

## Security notes
- The browser never decides company membership or privileged role.
- RLS is the database authorization boundary.
- The publishable key may be used by browser clients when RLS is correctly configured; never expose a Supabase secret/service-role key in client code.
- Callback redirects are restricted to same-origin relative paths.
- Stage 2 does not yet contain business-data RLS because CRM/employee tables arrive in later migrations.
