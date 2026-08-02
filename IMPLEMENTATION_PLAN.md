# Aven — Personal Career Workspace

A production-grade personal job application management platform. Not a job board, aggregator, or scraper — a private workspace where users track applications, manage documents, and use contextual AI assistance.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| UI | Shadcn v4 (base-luma), Tailwind CSS 4, CVA |
| Auth | Supabase Auth (email/password, OAuth, magic link) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (private buckets) |
| Validation | Zod |
| Language | TypeScript (strict) |

---

## Implementation Plan

### Phase 1: Environment & Dependencies

**Install packages:**
```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

**Create `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**Create Supabase client files:**
```
lib/
  supabase/
    client.ts    # Browser client (createBrowserClient)
    server.ts    # Server client (createServerClient)
    middleware.ts # Middleware client
```

---

### Phase 2: Authentication

**Supabase Auth handles sign-in natively. No third-party auth provider needed.**

**Supported methods:**
- Email/password (sign up, sign in, password reset)
- Magic link (passwordless email)
- OAuth (Google, GitHub — enable in Supabase Dashboard)

**Auth flow:**
```
1. User submits credentials via Supabase Auth client
2. Supabase validates and returns session (access + refresh tokens)
3. Tokens stored in httpOnly cookie via Supabase SSR
4. Server reads session from cookie on every request
```

**Pages:**
```
app/
  (auth)/
    layout.tsx          # Centered layout, no sidebar
    login/page.tsx      # Email/password + magic link + Google OAuth
    signup/page.tsx     # Email/password registration
    reset-password/page.tsx  # Password reset request
  auth/
    callback/route.ts   # Handle OAuth callback, set session
    confirm/route.ts    # Handle email confirmation
```

**Supabase Auth setup required:**
- Enable Email provider in Supabase Dashboard → Authentication → Providers
- Configure site URL and redirect URLs in Authentication → URL Configuration
- Enable Google OAuth provider if desired (requires Google Cloud credentials)

**Middleware (`middleware.ts`):**
- Refresh Supabase session on every request
- Redirect unauthenticated users to `/login`
- Allow `/login`, `/signup`, `/auth/callback`, `/auth/confirm` without session

---

### Phase 3: Database Schema

**Migration file: `migrations/001_initial_schema.sql`**

```sql
-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  headline TEXT,
  phone TEXT,
  location TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs (saved jobs, not yet applied)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  location TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  status TEXT DEFAULT 'saved'
    CHECK (status IN ('saved','interested','preparing','applied','interview','offer','accepted','rejected','withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications (linked to a job)
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','interviewing','offer','accepted','rejected','withdrawn')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents (CVs, cover letters, etc.)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('resume','cover_letter','other')),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline events (audit trail for applications)
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interviews
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  type TEXT CHECK (type IN ('phone','video','on_site','technical','behavioral')),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(user_id, status);
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_application_id ON documents(application_id);
CREATE INDEX idx_timeline_events_application_id ON timeline_events(application_id);
CREATE INDEX idx_notes_application_id ON notes(application_id);
CREATE INDEX idx_interviews_application_id ON interviews(application_id);
CREATE INDEX idx_interviews_scheduled_at ON interviews(user_id, scheduled_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Row Level Security (RLS):**
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Example policy (apply to all tables):
CREATE POLICY "Users can only access their own data"
  ON jobs FOR ALL
  USING (user_id = auth.uid());
```

---

### Phase 4: Supabase Storage

**Create bucket:**
- Name: `documents`
- Public: false (private)

**Storage paths:**
```
{user_id}/documents/{document_id}/{filename}
```

**RLS for storage:**
```sql
CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

### Phase 5: Core UI Structure

**Layout architecture:**
```
app/
├── layout.tsx                    # Root (html, body, fonts, metadata)
├── (auth)/
│   ├── layout.tsx                # Centered auth layout
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (dashboard)/
│   ├── layout.tsx                # Sidebar + main content
│   ├── page.tsx                  # Overview
│   ├── applications/
│   │   ├── page.tsx              # Applications list
│   │   ├── new/page.tsx          # Add job / create application
│   │   └── [id]/page.tsx         # Application detail workspace
│   ├── saved/
│   │   └── page.tsx              # Saved jobs
│   ├── interviews/
│   │   └── page.tsx              # Upcoming interviews
│   ├── documents/
│   │   └── page.tsx              # All documents
│   └── settings/
│       └── page.tsx              # User settings
├── api/
│   └── auth/
│       └── callback/route.ts     # Supabase auth callback
```

**Shadcn components to install:**
```bash
npx shadcn@latest add input label card dialog dropdown-menu separator avatar badge table tabs select textarea sheet command popover
```

**Sidebar navigation:**
```
Overview

Applications
Saved
Interviews
Documents

────────────

Insights

────────────

Settings
```

**Primary action:**
```
+ Add Job
```

---

### Phase 6: Core Pages

**Overview (`/`):**
- Application stats row (Saved / Applied / Interviewing / Offers)
- Needs Attention section (follow-ups due, interviews approaching, incomplete apps)
- Recent Applications list
- Upcoming Interviews list

**Applications list (`/applications`):**
- Table: Role | Company | Status | Applied Date
- Search bar + status filter dropdown
- Click row → navigate to detail

**Application detail (`/applications/[id]`):**
- Header: Job title, company, status badge, actions (edit, delete)
- Tabs:
  - Overview — job description, key details, quick actions
  - Documents — upload/manage CV, cover letter
  - Timeline — chronological event history
  - Notes — free-form notes
- Right sidebar: location, salary, URL, contact info

**Add Job (`/applications/new`):**
- Form: Job title, company, description, URL, location, salary range
- On submit: create job + application record, redirect to detail

---

### Phase 7: Data Access Patterns

**Server Components (default):** Direct Supabase queries in async components.

**Server Actions:** For all mutations (create, update, delete).

**Pattern:**
```typescript
// lib/supabase/server.ts
export async function createClient() {
  const supabase = await createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: await cookies() }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// app/(dashboard)/page.tsx
export default async function OverviewPage() {
  const { supabase, user } = await createClient();
  if (!user) redirect('/login');

  const { data: applications } = await supabase
    .from('applications')
    .select('*, job:jobs(*, company:companies(*))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return <Overview applications={applications ?? []} />;
}
```

**Authorization:** All queries filter by `user_id = auth.uid()`. RLS enforces at database level.

---

### Execution Order

| Phase | Description | Status |
|---|---|---|
| 1 | Environment, dependencies, Supabase client setup | DONE |
| 2 | Supabase Auth + proxy | DONE |
| 3 | Database migrations (profiles, jobs, applications, documents, etc.) | DONE |
| 4 | Storage bucket + RLS policies | DONE |
| 5 | Install Shadcn components, build layout + all pages | DONE |
| 6 | File upload + document management | TODO |
| 7 | Settings, password reset, profile management | TODO |

---

## Design Principles

- Clean typography with Inter/Geist fonts
- Strong hierarchy, generous whitespace
- Thin borders, subtle surfaces
- Compact but readable data
- Clear status indicators
- Keyboard-friendly interactions
- Proper loading, error, and empty states
- No AI aesthetic (no purple gradients, no glassmorphism, no oversized cards)

## Job Lifecycle

```
Saved → Interested → Preparing → Applied → Interview → Offer → Accepted/Rejected/Withdrawn
```

Jobs and Applications are separate entities. A user may save a job without ever applying.
