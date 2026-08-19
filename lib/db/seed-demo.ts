import { randomUUID } from "node:crypto";
import { getDb, rebuildOmniSearchIndex } from "./sqlite";

export const DEMO_MARKER = "[Demo Data]";

export interface SeedOptions {
  userId: string;
  positionId?: string | null;
}

/**
 * Seeds 3 curated demo jobs across pipeline stages, along with companies,
 * contacts, and an upcoming interview so a new user can immediately see and
 * test the board, fit scoring, job sheets, and search index.
 */
export function seedSampleJobsAndContacts({ userId, positionId }: SeedOptions): {
  jobIds: string[];
  companyIds: string[];
  contactIds: string[];
} {
  const db = getDb();

  // Clear previous demo records first so re-running never stacks duplicates
  try {
    deleteSampleData(userId);
  } catch (err) {
    console.warn("[seed-demo] Could not clear existing sample data:", err);
  }

  // Ensure standard board lists exist
  const defaults: [string, string, string, number][] = [
    ["Wishlist", "wishlist", "#38bdf8", 1],
    ["Preparing", "preparing", "#fbbf24", 2],
    ["Applied", "applied", "#c084fc", 3],
    ["Interview", "interview", "#84cc16", 4],
    ["Offer", "offer", "#14b8a6", 5],
    ["Rejected", "rejected", "#f87171", 6],
  ];

  const insertListStmt = db.prepare(
    `INSERT OR IGNORE INTO board_lists (id, user_id, name, kind, color, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const [name, kind, color, order] of defaults) {
    insertListStmt.run(randomUUID(), userId, name, kind, color, order);
  }

  // Get list IDs for wishlist, preparing, interview
  const lists = db
    .prepare("SELECT id, kind FROM board_lists WHERE user_id = ?")
    .all(userId) as { id: string; kind: string }[];

  const listMap = new Map<string, string>();
  for (const l of lists) {
    listMap.set(l.kind, l.id);
  }

  const wishlistId = listMap.get("wishlist");
  const preparingId = listMap.get("preparing");
  const interviewId = listMap.get("interview");
  const appliedId = listMap.get("applied");

  // 1. Create Companies
  const stripeId = randomUUID();
  const linearId = randomUUID();
  const vercelId = randomUUID();

  const insertCompanyStmt = db.prepare(
    `INSERT INTO companies (id, user_id, name, website, location, company_type, tier)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  insertCompanyStmt.run(stripeId, userId, "Stripe", "https://stripe.com", "San Francisco, CA", "Fintech", "1");
  insertCompanyStmt.run(linearId, userId, "Linear", "https://linear.app", "San Francisco, CA", "Productivity", "1");
  insertCompanyStmt.run(vercelId, userId, "Vercel", "https://vercel.com", "Remote", "Cloud Infrastructure", "1");

  // 2. Create Contacts
  const contact1Id = randomUUID();
  const contact2Id = randomUUID();

  const insertContactStmt = db.prepare(
    `INSERT INTO contacts (id, user_id, name, role, email, position, linkedin_url, company_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertContactStmt.run(
    contact1Id,
    userId,
    "Sarah Chen",
    "Technical Recruiter",
    "schen@stripe.demo",
    "Staff Talent Partner",
    "https://linkedin.com/in/sarah-chen-demo",
    stripeId,
    `${DEMO_MARKER} Reached out on LinkedIn for frontend architecture opportunities.`
  );

  insertContactStmt.run(
    contact2Id,
    userId,
    "Alex Rivera",
    "Hiring Manager",
    "arivera@linear.demo",
    "Engineering Lead",
    "https://linkedin.com/in/alex-rivera-demo",
    linearId,
    `${DEMO_MARKER} Point of contact for full-stack platform interview loop.`
  );

  // 3. Create Jobs
  const job1Id = randomUUID();
  const job2Id = randomUUID();
  const job3Id = randomUUID();

  const now = new Date();
  const interviewDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days ahead
  const deadlineDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const insertJobStmt = db.prepare(
    `INSERT INTO jobs (
      id, user_id, company_id, title, description, location, state,
      employment_type, salary_range, salary_min, salary_max, salary_currency, salary_period,
      work_location, skills, list_id, board_position, position_id, notes, tier, source, match_score, deadline
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 'active',
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`
  );

  // Job 1: Wishlist (Stripe)
  insertJobStmt.run(
    job1Id,
    userId,
    stripeId,
    "Staff Frontend Architect",
    "Design and build next-generation payment interfaces and design systems. Requires deep experience in TypeScript, React 19, web performance optimization, and accessible UI engineering.",
    "San Francisco, CA (Remote)",
    "Full-time",
    "$195,000 - $240,000",
    195000,
    240000,
    "USD",
    "yearly",
    "Remote",
    JSON.stringify(["TypeScript", "React", "Next.js", "Design Systems", "Web Performance", "Accessibility"]),
    wishlistId ?? null,
    1,
    positionId ?? null,
    JSON.stringify([
      {
        id: randomUUID(),
        title: "Recruiter outreach",
        bullets: [
          `${DEMO_MARKER} Introduced by Sarah Chen. Strong alignment with React server components and high-throughput dashboard architecture.`,
        ],
      },
    ]),
    "1",
    "LinkedIn",
    94,
    deadlineDate
  );

  // Job 2: Preparing (Linear)
  insertJobStmt.run(
    job2Id,
    userId,
    linearId,
    "Full Stack Platform Engineer",
    "Build high-performance client applications with local-first SQLite sync, real-time collaboration, and fluid keyboard-driven workflows.",
    "San Francisco, CA",
    "Full-time",
    "$170,000 - $210,000",
    170000,
    210000,
    "USD",
    "yearly",
    "Hybrid",
    JSON.stringify(["TypeScript", "Node.js", "SQLite", "React", "Real-time Sync", "WebSockets"]),
    preparingId ?? null,
    1,
    positionId ?? null,
    JSON.stringify([
      {
        id: randomUUID(),
        title: "Application prep",
        bullets: [
          `${DEMO_MARKER} Tailoring master resume to emphasize offline-first caching and synchronous SQLite architecture.`,
        ],
      },
    ]),
    "1",
    "Careers Page",
    88,
    deadlineDate
  );

  // Job 3: Interview (Vercel)
  insertJobStmt.run(
    job3Id,
    userId,
    vercelId,
    "Senior Cloud Systems Engineer",
    "Scale Next.js Edge infrastructure and build developer-facing telemetry, streaming SSR pipelines, and zero-config deployment workflows.",
    "Remote, Worldwide",
    "Full-time",
    "$185,000 - $225,000",
    185000,
    225000,
    "USD",
    "yearly",
    "Remote",
    JSON.stringify(["Next.js", "Edge Computing", "TypeScript", "Distributed Systems", "Cloudflare Workers"]),
    interviewId ?? null,
    1,
    positionId ?? null,
    JSON.stringify([
      {
        id: randomUUID(),
        title: "Interview notes",
        bullets: [
          `${DEMO_MARKER} Recruiter screen passed. Technical round with engineering manager scheduled. Review streaming SSR architecture.`,
        ],
      },
    ]),
    "1",
    "Direct Reachout",
    91,
    deadlineDate
  );

  // 4. Connect Job Contacts
  const insertJobContactStmt = db.prepare(
    "INSERT OR IGNORE INTO job_contacts (job_id, contact_id) VALUES (?, ?)"
  );
  insertJobContactStmt.run(job1Id, contact1Id);
  insertJobContactStmt.run(job2Id, contact2Id);

  // 5. Create Interview Record for Job 3
  const insertInterviewStmt = db.prepare(
    `INSERT INTO interviews (
      id, user_id, job_id, scheduled_at, type, location, meeting_url,
      interviewer_name, interviewer_email, prep_notes, status, duration_minutes
    ) VALUES (
      ?, ?, ?, ?, 'technical', 'Google Meet', 'https://meet.google.com/demo-attrack',
      'Alex Rivera', 'arivera@vercel.demo',
      'Deep dive into Next.js App Router, streaming SSE protocols, and resilient local caching.',
      'scheduled', 45
    )`
  );
  insertInterviewStmt.run(
    randomUUID(),
    userId,
    job3Id,
    interviewDate.toISOString()
  );

  // 6. If applied list exists, create application for Job 3 so applications table is active
  if (appliedId) {
    const insertAppStmt = db.prepare(
      `INSERT OR IGNORE INTO applications (
        id, user_id, job_id, status, applied_at, notes
      ) VALUES (?, ?, ?, 'interview', ?, ?)`
    );
    insertAppStmt.run(
      randomUUID(),
      userId,
      job3Id,
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      `${DEMO_MARKER} Application submitted via referral. Advanced to technical interview round.`
    );
  }

  // Refresh FTS5 omni search
  rebuildOmniSearchIndex(db);

  return {
    jobIds: [job1Id, job2Id, job3Id],
    companyIds: [stripeId, linearId, vercelId],
    contactIds: [contact1Id, contact2Id],
  };
}

/**
 * Cleanly removes all demo/sample records created during onboarding
 * without affecting user's own data.
 */
export function deleteSampleData(userId: string): { removedCount: number } {
  const db = getDb();

  // Find demo jobs with DEMO_MARKER
  const demoJobs = db
    .prepare("SELECT id FROM jobs WHERE user_id = ? AND notes LIKE ?")
    .all(userId, `%${DEMO_MARKER}%`) as { id: string }[];

  const demoJobIds = demoJobs.map((j) => j.id);

  if (demoJobIds.length > 0) {
    const placeholders = demoJobIds.map(() => "?").join(",");
    try {
      db.prepare(`DELETE FROM applications WHERE job_id IN (${placeholders})`).run(...demoJobIds);
    } catch {}
    try {
      db.prepare(`DELETE FROM interviews WHERE job_id IN (${placeholders})`).run(...demoJobIds);
    } catch {}
    try {
      db.prepare(`DELETE FROM job_contacts WHERE job_id IN (${placeholders})`).run(...demoJobIds);
    } catch {}
    try {
      db.prepare(`DELETE FROM job_documents WHERE job_id IN (${placeholders})`).run(...demoJobIds);
    } catch {}
    try {
      db.prepare(`DELETE FROM job_deadlines WHERE job_id IN (${placeholders})`).run(...demoJobIds);
    } catch {}
    db.prepare(`DELETE FROM jobs WHERE id IN (${placeholders}) AND user_id = ?`).run(...demoJobIds, userId);
  }

  // Delete demo contacts (and unbind job_contacts)
  const demoContacts = db
    .prepare("SELECT id FROM contacts WHERE user_id = ? AND notes LIKE ?")
    .all(userId, `%${DEMO_MARKER}%`) as { id: string }[];
  const demoContactIds = demoContacts.map((c) => c.id);
  if (demoContactIds.length > 0) {
    const cPlaceholders = demoContactIds.map(() => "?").join(",");
    try {
      db.prepare(`DELETE FROM job_contacts WHERE contact_id IN (${cPlaceholders})`).run(...demoContactIds);
    } catch {}
    db.prepare(`DELETE FROM contacts WHERE id IN (${cPlaceholders}) AND user_id = ?`).run(...demoContactIds, userId);
  }

  // Delete demo companies if they have no remaining jobs
  const sampleCompanyNames = ["Stripe", "Linear", "Vercel"];
  for (const name of sampleCompanyNames) {
    const remaining = db
      .prepare(
        `SELECT COUNT(*) as count FROM jobs j
         JOIN companies c ON j.company_id = c.id
         WHERE c.name = ? AND j.user_id = ?`
      )
      .get(name, userId) as { count: number } | undefined;

    if (!remaining || remaining.count === 0) {
      db.prepare("DELETE FROM companies WHERE name = ? AND user_id = ?").run(name, userId);
    }
  }

  rebuildOmniSearchIndex(db);
  return { removedCount: demoJobIds.length };
}

/** Checks whether user currently has demo data seeded */
export function hasDemoData(userId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND notes LIKE ?")
    .get(userId, `%${DEMO_MARKER}%`) as { count: number } | undefined;
  return (row?.count ?? 0) > 0;
}
