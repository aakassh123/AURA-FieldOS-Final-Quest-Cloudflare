# AURA FieldOS — Stage 3

## Company + Employee + Team Management

Stage 3 adds the first real multi-tenant organization layer on top of Stage 2 authentication.

### Included

- Company workspace bootstrap
- First-user promotion to `COMPANY_ADMIN`
- Employee directory
- Employee role, manager, designation, status and joined date
- Team CRUD
- Team membership
- Company isolation through PostgreSQL RLS
- Database validation for cross-company manager/team links
- Protected role assignment rules
- Protected auth-user linking rules
- Role-aware organization navigation
- Server Actions for mutations + `revalidatePath`

### Run

1. Copy `.env.example` to `.env.local` and fill in Supabase URL + publishable key.
2. In Supabase SQL Editor, run migrations in order:
   - `supabase/migrations/0001_auth_roles.sql`
   - `supabase/migrations/0002_company_employee_teams.sql`
3. Configure Supabase Auth redirect URL for `/auth/callback`.
4. Install dependencies and verify:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

5. Sign up. You will be sent to `/setup` if your profile has no company.
6. Create the company. Your account becomes the first Company Admin and an `EMP-001` employee record is created automatically.
7. Open Employees and Teams from the sidebar.

### Important Stage 3 limitation

Employee records can be created now, but this stage intentionally does **not** send email invitations or create Auth users with a service-role key. Account invitation/linking will be a separate protected workflow. This avoids exposing the Supabase service-role key and keeps the current browser architecture safe.

### Security notes

- The browser never chooses its own `company_id` for authorization.
- RLS derives the active company from the authenticated profile.
- `SUPER_ADMIN` cannot be assigned to normal company employees.
- Only Company Admins can assign `COMPANY_ADMIN`.
- Only Company Admins can link an employee to an existing Auth user.
- Manager and team relationships must belong to the same company.
- Database functions using `SECURITY DEFINER` pin `search_path` to an empty value and schema-qualify relations.

Supabase recommends pinning `search_path` when using `SECURITY DEFINER` functions, and Next.js Server Actions are designed for server-side form mutations with cache revalidation. See the project research notes in the build conversation for the official references.
