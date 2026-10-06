# AURA FieldOS — Stage 10

## Realtime + Notifications

Stage 10 adds a persistent, user-scoped notification system and Supabase Realtime updates.

### Included

- `notifications` table with company + user isolation
- Notification types for lead assignment, task assignment, visit planning, expense review and commission creation
- Database triggers create notifications from trusted server-side events
- PostgreSQL RLS allows a user to read/update only their own company's notifications
- `supabase_realtime` publication includes `public.notifications`
- Topbar notification bell with live unread count
- Realtime subscription for the authenticated user's notification rows
- `/notifications` inbox with mark-read and mark-all-read actions
- `/api/notifications` initial notification feed
- Server Actions for read-state changes
- Existing dashboard/CRM/field/finance flows remain the event sources

### Migration

Run after Stage 1–9 migrations:

```text
0001_auth_roles.sql
0002_company_employee_teams.sql
0003_crm.sql
0004_field_work.sql
0005_maps_trips.sql
0006_finance_compensation.sql
0007_realtime_notifications.sql
```

### Supabase Realtime setup

Make sure Realtime is enabled for the project. The migration adds `notifications` to the `supabase_realtime` publication.

The client uses a filtered Postgres Changes subscription:

```text
notifications:user-id
  INSERT public.notifications
  filter: user_id=eq.<authenticated-user-id>
```

Because the notifications table has RLS, the database remains the final authorization boundary.

### Event examples

```text
Lead assigned
    → notification to lead owner

Task assigned
    → notification to assignee

Visit planned
    → notification to assigned salesperson

Expense approved/rejected
    → notification to expense owner

Commission created
    → notification to salesperson
```

### Important architecture note

This stage uses persisted Postgres Changes because notifications are durable records that already have an RLS-protected table. Supabase currently recommends Broadcast for larger-scale realtime workloads; Broadcast can be introduced later for high-volume ephemeral events such as live operational signals without changing the notification data model.

### Verification

Install dependencies locally and run:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Then test with two authenticated users in the same company:

1. Assign a lead to User B.
2. User B should receive the notification without refreshing.
3. Open it and verify it becomes read.
4. Approve/reject an expense owned by User B.
5. Verify User B receives the finance notification.
6. Create a visit for User B and verify the live notification.
