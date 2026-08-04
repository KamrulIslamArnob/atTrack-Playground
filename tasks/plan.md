# Implementation Plan: Activity Logging + RBAC + Admin Panel

## Overview
Add server-side activity logging for audit trails, role-based authentication (User/Admin) with JWT, and a full admin panel for user management, activity tracing, and AI usage tracking. All role logic stays server-side; roles are never exposed in cookies, client code, or public URLs.

## Architecture Decisions
- **Role storage**: `role` column on `profiles` table (default `'user'`, values: `'user'` | `'admin'`). Simple, no extra join table needed.
- **Ban system**: `is_banned` boolean + `banned_at` timestamp on `profiles`. Checked in middleware AND server actions (defense in depth).
- **Activity logging**: New `activity_logs` table. Every server action calls `logActivity()` which inserts with user_id, action, resource, metadata, IP, user_agent.
- **AI usage tracking**: New `ai_usage_logs` table. Each AI call logs user_id, model, tokens, cost, timestamp.
- **Middleware**: Rename `proxy.ts` → `middleware.ts` and add role-based route protection. Admin routes (`/admin/*`) require `role === 'admin'`.
- **Roles never leave server**: No role in cookies, no role in JWT claims visible to client, no role in `user_metadata`. The middleware reads role from DB (cached per request via Supabase client). Admin panel server actions verify role on every call.
- **Banned users**: Middleware blocks all requests. Server actions also check `is_banned` before executing. Even if a banned user has a valid session cookie, they cannot perform any action.

## Task List

### Phase 1: Database Schema (Migration 017)
- [ ] Task 1: Create migration 017 with `activity_logs` table, `ai_usage_logs` table, add `role`/`is_banned`/`banned_at` to `profiles`
- [ ] Task 2: Add RLS policies for admin access (admin can read all activity_logs, ai_usage_logs, profiles)

### Phase 2: Activity Logging System
- [ ] Task 3: Create `lib/actions/activity-log.ts` with `logActivity()` server action
- [ ] Task 4: Create `lib/actions/ai-usage.ts` with `logAiUsage()` server action
- [ ] Task 5: Instrument all existing server actions (auth, jobs, applications, interviews, documents, email, mcq) to call `logActivity()`

### Phase 3: Role-Based Auth
- [ ] Task 6: Update `lib/auth.ts` — `getUser()` returns role, `getAdminUser()` verifies admin role
- [ ] Task 7: Rename `proxy.ts` → `middleware.ts`, add admin route protection, add banned user check
- [ ] Task 8: Update `lib/actions/auth.ts` — signUp sets default role, signIn checks ban status, log activity on all auth events
- [ ] Task 9: Update `deleteAccount` to handle admin self-deletion safely

### Phase 4: Admin Panel
- [ ] Task 10: Create `app/(admin)/admin/layout.tsx` with admin sidebar + header
- [ ] Task 11: Create `app/(admin)/admin/page.tsx` — Admin dashboard (user count, AI usage stats, recent activity)
- [ ] Task 12: Create `app/(admin)/admin/users/page.tsx` — User management (list, search, ban/unban, view profile)
- [ ] Task 13: Create `app/(admin)/admin/activity/page.tsx` — Activity log viewer (filterable by user, action, date)
- [ ] Task 14: Create `app/(admin)/admin/ai-usage/page.tsx` — AI usage tracking (per-user stats, model usage, token consumption)

### Phase 5: Security Hardening
- [ ] Task 15: Ensure banned users cannot login (auth action check)
- [ ] Task 16: Ensure banned users with valid sessions are blocked (middleware check)
- [ ] Task 17: Ensure admin routes are triple-checked (middleware + layout + every server action)
- [ ] Task 18: Ensure roles are never in cookies, client components, or API responses

### Checkpoint: After Phase 5
- [ ] All existing tests pass
- [ ] Build succeeds
- [ ] Non-admin user cannot access /admin/*
- [ ] Banned user cannot login or perform any action
- [ ] Activity logs are created for all server actions
- [ ] AI usage is tracked per user

## Security Model

```
Request → middleware.ts
  ├── Is route /admin/*? → getUser() → Check role === 'admin' → Allow/Deny
  ├── Is route protected? → getUser() → Check is_banned → Allow/Deny/Redirect
  └── Pass through

Server Action → lib/auth.ts
  ├── getUser() → Check is_banned → Redirect if banned
  ├── getAdminUser() → Check role === 'admin' → Throw if not admin
  └── logActivity() → Insert into activity_logs
```

## Files Likely Touched
- `migrations/017_activity_logging_and_rbac.sql` (new)
- `lib/auth.ts` (modify)
- `lib/actions/auth.ts` (modify)
- `lib/actions/activity-log.ts` (new)
- `lib/actions/ai-usage.ts` (new)
- `middleware.ts` (new, replaces proxy.ts)
- `proxy.ts` (delete)
- `app/(admin)/admin/layout.tsx` (new)
- `app/(admin)/admin/page.tsx` (new)
- `app/(admin)/admin/users/page.tsx` (new)
- `app/(admin)/admin/activity/page.tsx` (new)
- `app/(admin)/admin/ai-usage/page.tsx` (new)
- All existing server actions in `lib/actions/` (modify to add logging)
