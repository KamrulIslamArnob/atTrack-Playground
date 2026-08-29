import { randomUUID } from "node:crypto";
import { getDb, rebuildOmniSearchIndex } from "./sqlite";
import { moduleLogger } from "../log";

const log = moduleLogger("db.seed-demo");

export const DEMO_MARKER = "[Demo Data]";

export interface SeedOptions {
  userId: string;
  positionId?: string | null;
}

/**
 * Seeds a rich, comprehensive demo dataset across all pipeline stages,
 * Big Tech & AI companies, famous tech network contacts, interviews,
 * deadlines, and resources for realistic screenshots and testing.
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
    log.warn({ err }, "Could not clear existing sample data");
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

  // Fetch list IDs
  const lists = db
    .prepare("SELECT id, kind FROM board_lists WHERE user_id = ?")
    .all(userId) as { id: string; kind: string }[];

  const listMap = new Map<string, string>();
  for (const l of lists) {
    listMap.set(l.kind, l.id);
  }

  const wishlistId = listMap.get("wishlist");
  const preparingId = listMap.get("preparing");
  const appliedId = listMap.get("applied");
  const interviewId = listMap.get("interview");
  const offerId = listMap.get("offer");
  const rejectedId = listMap.get("rejected");

  // 1. Create Positions (if user doesn't already have primary position)
  let primaryPosId = positionId;
  const now = new Date();
  const nowIso = now.toISOString();

  if (!primaryPosId) {
    const existingPos = db
      .prepare("SELECT id FROM positions WHERE user_id = ? AND is_primary = 1")
      .get(userId) as { id: string } | undefined;

    if (existingPos) {
      primaryPosId = existingPos.id;
    } else {
      primaryPosId = randomUUID();
      db.prepare(
        `INSERT INTO positions (id, user_id, name, experience_level, is_primary, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      ).run(primaryPosId, userId, "Staff Frontend Architect", "senior", nowIso, nowIso);
    }
  }

  // Add supporting positions if not present
  const secondaryPositions = [
    { name: "Senior AI Platform Engineer", level: "senior" },
    { name: "Principal Systems Engineer", level: "senior" },
    { name: "Engineering Manager - Developer Experience", level: "senior" },
    { name: "Lead Product Systems Designer", level: "mid" },
  ];
  for (const pos of secondaryPositions) {
    const exists = db
      .prepare("SELECT id FROM positions WHERE user_id = ? AND lower(name) = lower(?)")
      .get(userId, pos.name) as { id: string } | undefined;
    if (!exists) {
      db.prepare(
        `INSERT INTO positions (id, user_id, name, experience_level, is_primary, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).run(randomUUID(), userId, pos.name, pos.level, nowIso, nowIso);
    }
  }

  // 2. Create Companies (17 Iconic Tech & AI Leaders)
  const companyDefs = [
    { key: "openai", name: "OpenAI", website: "https://openai.com", location: "San Francisco, CA", type: "AI Research & Frontier Models", tier: "1" },
    { key: "anthropic", name: "Anthropic", website: "https://anthropic.com", location: "San Francisco, CA (Hybrid)", type: "AI Safety & Research", tier: "1" },
    { key: "google", name: "Google DeepMind", website: "https://deepmind.google", location: "Mountain View, CA", type: "AI Research & Systems", tier: "1" },
    { key: "stripe", name: "Stripe", website: "https://stripe.com", location: "San Francisco, CA (Remote)", type: "Fintech & Payments Infrastructure", tier: "1" },
    { key: "apple", name: "Apple", website: "https://apple.com", location: "Cupertino, CA", type: "Consumer Tech & Operating Systems", tier: "1" },
    { key: "meta", name: "Meta", website: "https://meta.com", location: "Menlo Park, CA", type: "AI & Distributed Platforms", tier: "1" },
    { key: "nvidia", name: "NVIDIA", website: "https://nvidia.com", location: "Santa Clara, CA", type: "AI Hardware & Compute Systems", tier: "1" },
    { key: "microsoft", name: "Microsoft", website: "https://microsoft.com", location: "Redmond, WA (Remote)", type: "Cloud & Developer Tools", tier: "1" },
    { key: "linear", name: "Linear", website: "https://linear.app", location: "San Francisco, CA", type: "Productivity & High-Performance Software", tier: "1" },
    { key: "vercel", name: "Vercel", website: "https://vercel.com", location: "Remote, Worldwide", type: "Frontend Cloud & Edge Runtime", tier: "1" },
    { key: "figma", name: "Figma", website: "https://figma.com", location: "San Francisco, CA", type: "Design & Collaborative Systems", tier: "1" },
    { key: "supabase", name: "Supabase", website: "https://supabase.com", location: "Remote, Worldwide", type: "Open Source Backend Infrastructure", tier: "1" },
    { key: "github", name: "GitHub", website: "https://github.com", location: "San Francisco, CA (Remote)", type: "Developer Platform & AI Workflows", tier: "1" },
    { key: "datadog", name: "Datadog", website: "https://datadoghq.com", location: "New York, NY (Hybrid)", type: "Observability & Cloud Security", tier: "1" },
    { key: "cloudflare", name: "Cloudflare", website: "https://cloudflare.com", location: "San Francisco, CA (Hybrid)", type: "Edge Network & Cyber Security", tier: "1" },
    { key: "airbnb", name: "Airbnb", website: "https://airbnb.com", location: "San Francisco, CA (Remote)", type: "Global Marketplace & Design Systems", tier: "1" },
    { key: "netflix", name: "Netflix", website: "https://netflix.com", location: "Los Gatos, CA", type: "Distributed Streaming Architecture", tier: "1" },
  ];

  const insertCompanyStmt = db.prepare(
    `INSERT INTO companies (id, user_id, name, website, location, company_type, tier)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const companyMap = new Map<string, string>();
  const companyIds: string[] = [];

  for (const c of companyDefs) {
    const id = randomUUID();
    companyMap.set(c.key, id);
    companyIds.push(id);
    insertCompanyStmt.run(id, userId, c.name, c.website, c.location, c.type, c.tier);
  }

  // 3. Create Famous Network Contacts & Top Talent Partners (21 Contacts)
  const contactDefs = [
    // Famous Founders & Tech Leaders
    { key: "sam", comp: "openai", name: "Sam Altman", role: "CEO & Co-founder", title: "Chief Executive Officer", email: "sam@openai.demo", linkedin: "https://linkedin.com/in/sam-altman-demo", notes: `${DEMO_MARKER} Discussed frontier reasoning agent research and next-gen AI interface paradigms.` },
    { key: "dario", comp: "anthropic", name: "Dario Amodei", role: "CEO & Co-founder", title: "Chief Executive Officer", email: "dario@anthropic.demo", linkedin: "https://linkedin.com/in/dario-amodei-demo", notes: `${DEMO_MARKER} Met at AI Safety Summit. Discussed constitutional alignment and autonomous tooling benchmarks.` },
    { key: "guillermo", comp: "vercel", name: "Guillermo Rauch", role: "CEO & Founder", title: "Chief Executive Officer", email: "rauchg@vercel.demo", linkedin: "https://linkedin.com/in/guillermo-rauch-demo", notes: `${DEMO_MARKER} Connected on Next.js 16 App Router streaming, Turbo build engines, and edge sync performance.` },
    { key: "karri", comp: "linear", name: "Karri Saarinen", role: "CEO & Co-founder", title: "Chief Executive Officer", email: "karri@linear.demo", linkedin: "https://linkedin.com/in/karri-saarinen-demo", notes: `${DEMO_MARKER} Explored keyboard-first UI ergonomics and synchronous local SQLite cache synchronization.` },
    { key: "dylan", comp: "figma", name: "Dylan Field", role: "CEO & Co-founder", title: "Chief Executive Officer", email: "dylan@figma.demo", linkedin: "https://linkedin.com/in/dylan-field-demo", notes: `${DEMO_MARKER} Discussed web canvas WebGPU rendering pipelines and cross-platform design token sync.` },
    { key: "patrick", comp: "stripe", name: "Patrick Collison", role: "CEO & Co-founder", title: "Chief Executive Officer", email: "patrick@stripe.demo", linkedin: "https://linkedin.com/in/patrick-collison-demo", notes: `${DEMO_MARKER} Keynote alignment at Stripe Sessions. High-throughput distributed payment workflows.` },
    { key: "kelsey", comp: "google", name: "Kelsey Hightower", role: "Distinguished Engineer / Advisor", title: "Cloud Architecture Fellow", email: "kelsey@google.demo", linkedin: "https://linkedin.com/in/kelsey-hightower-demo", notes: `${DEMO_MARKER} Architectural mentor for resilient zero-downtime distributed systems and local-first architecture.` },
    { key: "sarah", comp: "google", name: "Sarah Drasner", role: "VP of Engineering", title: "Vice President of Web Engineering", email: "sdrasner@google.demo", linkedin: "https://linkedin.com/in/sarah-drasner-demo", notes: `${DEMO_MARKER} Executive sponsor. Discussed engineering velocity, web platform standards, and design system governance.` },
    { key: "cassidy", comp: "github", name: "Cassidy Williams", role: "Head of Developer Experience", title: "Head of DevRel & Ecosystem", email: "cassidy@github.demo", linkedin: "https://linkedin.com/in/cassidy-williams-demo", notes: `${DEMO_MARKER} Open-source tooling collaborator and technical career community advocate.` },
    { key: "dan", comp: "meta", name: "Dan Abramov", role: "React Core Contributor", title: "Staff UI Systems Engineer", email: "dan@meta.demo", linkedin: "https://linkedin.com/in/dan-abramov-demo", notes: `${DEMO_MARKER} Technical sounding board on React 19 Server Actions, compiler optimizations, and streaming UI state.` },
    { key: "gergely", comp: "uber", name: "Gergely Orosz", role: "Author, The Pragmatic Engineer", title: "Engineering Lead & Writer", email: "gergely@pragmatic.demo", linkedin: "https://linkedin.com/in/gergely-orosz-demo", notes: `${DEMO_MARKER} Editorial connection for Big Tech engineering hiring benchmarks and compensation negotiation.` },
    { key: "swyx", comp: "openai", name: "Swyx (Shawn Wang)", role: "AI Engineer Foundation", title: "AI Engineering Fellow", email: "swyx@ai-engineer.demo", linkedin: "https://linkedin.com/in/swyx-demo", notes: `${DEMO_MARKER} AI engineering mentor for agentic tool use, structured schema extraction, and multi-model routing.` },
    { key: "nat", comp: "github", name: "Nat Friedman", role: "AI Investor & Former GitHub CEO", title: "Managing Partner", email: "nat@ai-grant.demo", linkedin: "https://linkedin.com/in/nat-friedman-demo", notes: `${DEMO_MARKER} Advocate for autonomous developer tooling and local-first software craftsmanship.` },

    // Lead Technical Recruiters & Talent Executives
    { key: "rachel", comp: "openai", name: "Rachel Morrison", role: "Lead Technical Talent Partner", title: "Principal AI Recruiter", email: "rmorrison@openai.demo", linkedin: "https://linkedin.com/in/rachel-morrison-demo", notes: `${DEMO_MARKER} Lead recruiter for OpenAI frontier systems and application architecture teams.` },
    { key: "david", comp: "anthropic", name: "David Lin", role: "Head of Engineering Recruiting", title: "Director of Technical Talent", email: "dlin@anthropic.demo", linkedin: "https://linkedin.com/in/david-lin-demo", notes: `${DEMO_MARKER} Coordinating final offer review and equity package for Claude Applications Engineer.` },
    { key: "marcus", comp: "stripe", name: "Marcus Vance", role: "Principal Talent Partner", title: "Staff Technical Recruiter", email: "mvance@stripe.demo", linkedin: "https://linkedin.com/in/marcus-vance-demo", notes: `${DEMO_MARKER} Primary point of contact for Staff Frontend Architect interview panel at Stripe.` },
    { key: "elena", comp: "google", name: "Elena Rostova", role: "Executive Tech Recruiter", title: "Lead AI Talent Partner", email: "erostova@deepmind.demo", linkedin: "https://linkedin.com/in/elena-rostova-demo", notes: `${DEMO_MARKER} Managing reachout for Gemini Core Systems & Multi-Modal evaluation engineering.` },
    { key: "chloe", comp: "apple", name: "Chloe Bennett", role: "Lead Engineering Talent Partner", title: "Senior Talent Partner", email: "cbennett@apple.demo", linkedin: "https://linkedin.com/in/chloe-bennett-demo", notes: `${DEMO_MARKER} Recruiter contact for Apple Web Technologies and UI Framework engineering roles.` },
    { key: "aiden", comp: "vercel", name: "Aiden Thorne", role: "Staff Talent Lead", title: "Engineering Talent Partner", email: "athorne@vercel.demo", linkedin: "https://linkedin.com/in/aiden-thorne-demo", notes: `${DEMO_MARKER} Recruiter lead for Next.js Core and Edge Platform engineering tracks.` },
    { key: "maya", comp: "figma", name: "Maya Patel", role: "Senior Technical Recruiter", title: "Design Systems Recruiter", email: "mpatel@figma.demo", linkedin: "https://linkedin.com/in/maya-patel-demo", notes: `${DEMO_MARKER} Reached out for Senior Canvas Performance and Rendering Architecture opportunities.` },
    { key: "leo", comp: "supabase", name: "Leo Zhang", role: "Head of Talent", title: "Head of People & Recruiting", email: "lzhang@supabase.demo", linkedin: "https://linkedin.com/in/leo-zhang-demo", notes: `${DEMO_MARKER} Coordinating offer details for Lead Frontend Infrastructure role.` },
  ];

  const insertContactStmt = db.prepare(
    `INSERT INTO contacts (id, user_id, name, role, email, position, linkedin_url, company_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const contactMap = new Map<string, string>();
  const contactIds: string[] = [];

  for (const c of contactDefs) {
    const id = randomUUID();
    contactMap.set(c.key, id);
    contactIds.push(id);
    const compId = companyMap.get(c.comp) || null;
    insertContactStmt.run(id, userId, c.name, c.role, c.email, c.title, c.linkedin, compId, c.notes);
  }

  // 4. Create Jobs Across ALL Pipeline Categories (19 Diverse Roles)
  const jobDefs = [
    // --- WISHLIST ---
    {
      comp: "openai",
      title: "Staff AI Systems Architect",
      desc: "Architect next-generation distributed inference infrastructure and autonomous agent runtime interfaces. Deep mastery of TypeScript, Python, high-throughput streaming SSE, and LLM orchestration.",
      loc: "San Francisco, CA (Remote)",
      type: "Full-time",
      workLoc: "Remote",
      min: 250000,
      max: 320000,
      salary: "$250,000 - $320,000",
      skills: ["TypeScript", "Next.js", "Python", "Distributed Systems", "LLM Orchestration", "Agentic Workflows"],
      listId: wishlistId,
      pos: 1,
      tier: "1",
      source: "Referral (Sam Altman)",
      matchScore: 97,
      daysOffset: 14,
      note: `${DEMO_MARKER} Referred by Sam Altman. Strong synergy with local-first streaming architecture and multi-model AI routing.`,
      contacts: ["sam", "rachel"],
    },
    {
      comp: "apple",
      title: "Senior Software Engineer (UI Frameworks)",
      desc: "Engineer fluid, high-fidelity user interface engines and design systems across web and macOS environments. Focus on 120Hz smooth rendering, accessibility, and micro-interactions.",
      loc: "Cupertino, CA",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 200000,
      max: 250000,
      salary: "$200,000 - $250,000",
      skills: ["TypeScript", "React", "Design Systems", "Web Performance", "Accessibility (WCAG)", "CSS Architecture"],
      listId: wishlistId,
      pos: 2,
      tier: "1",
      source: "LinkedIn",
      matchScore: 92,
      daysOffset: 20,
      note: `${DEMO_MARKER} Recruiter reachout from Chloe Bennett. Aligns with design engineering excellence and strict design token rigor.`,
      contacts: ["chloe"],
    },
    {
      comp: "nvidia",
      title: "WebGPU Platform Systems Architect",
      desc: "Build browser-accelerated AI visual pipelines and WebGPU compute shaders for enterprise generative engineering suites.",
      loc: "Santa Clara, CA",
      type: "Full-time",
      workLoc: "On-site",
      min: 220000,
      max: 280000,
      salary: "$220,000 - $280,000",
      skills: ["WebGPU", "TypeScript", "Compute Shaders", "High-Performance Graphics", "React"],
      listId: wishlistId,
      pos: 3,
      tier: "1",
      source: "NVIDIA Careers",
      matchScore: 89,
      daysOffset: 28,
      note: `${DEMO_MARKER} Cutting-edge compute role. Focus on browser-based real-time AI rendering.`,
      contacts: [],
    },
    {
      comp: "meta",
      title: "Staff Infrastructure Engineer (Llama Ecosystem)",
      desc: "Scale open-source developer tooling and distributed model benchmarking suites powering Llama foundation model deployments globally.",
      loc: "Menlo Park, CA (Hybrid)",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 230000,
      max: 290000,
      salary: "$230,000 - $290,000",
      skills: ["React 19", "TypeScript", "Node.js", "Distributed Infrastructure", "AI Tooling"],
      listId: wishlistId,
      pos: 4,
      tier: "1",
      source: "Dan Abramov Intro",
      matchScore: 94,
      daysOffset: 22,
      note: `${DEMO_MARKER} Dan Abramov recommended connecting with engineering leadership for Developer Tooling track.`,
      contacts: ["dan"],
    },

    // --- PREPARING ---
    {
      comp: "figma",
      title: "Senior Canvas Performance Engineer",
      desc: "Optimize high-fps interactive canvas rendering and real-time collaboration multiplayer sync protocols. Work closely with design systems teams.",
      loc: "San Francisco, CA",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 190000,
      max: 240000,
      salary: "$190,000 - $240,000",
      skills: ["Canvas WebGL", "TypeScript", "Real-Time Sync", "Performance Profiling", "Design Tokens"],
      listId: preparingId,
      pos: 1,
      tier: "1",
      source: "Figma Careers",
      matchScore: 91,
      daysOffset: 6,
      note: `${DEMO_MARKER} Tailoring portfolio and interactive rendering demo project for Maya Patel's team.`,
      contacts: ["dylan", "maya"],
    },
    {
      comp: "supabase",
      title: "Full Stack Realtime Sync Engineer",
      desc: "Build high-throughput realtime WebSocket broadcast engines and local SQLite sync primitives for distributed Edge apps.",
      loc: "Remote, Worldwide",
      type: "Full-time",
      workLoc: "Remote",
      min: 175000,
      max: 215000,
      salary: "$175,000 - $215,000",
      skills: ["SQLite", "PostgreSQL", "TypeScript", "WebSockets", "Node.js", "Local-First Sync"],
      listId: preparingId,
      pos: 2,
      tier: "1",
      source: "Wellfound",
      matchScore: 93,
      daysOffset: 8,
      note: `${DEMO_MARKER} Preparing custom cover letter emphasizing native node:sqlite architecture and WAL mode query builders.`,
      contacts: ["leo"],
    },
    {
      comp: "github",
      title: "Principal Copilot Architecture Engineer",
      desc: "Design resilient context-gathering pipelines and multi-agent IDE extension protocols that power GitHub Copilot Workspace.",
      loc: "San Francisco, CA (Remote)",
      type: "Full-time",
      workLoc: "Remote",
      min: 210000,
      max: 260000,
      salary: "$210,000 - $260,000",
      skills: ["TypeScript", "VS Code Extensions", "Multi-Agent Systems", "LLM Prompting", "Node.js"],
      listId: preparingId,
      pos: 3,
      tier: "1",
      source: "Referral (Cassidy Williams)",
      matchScore: 95,
      daysOffset: 10,
      note: `${DEMO_MARKER} Cassidy Williams submitting internal referral. Updating master resume with agentic subsystem achievements.`,
      contacts: ["cassidy", "nat"],
    },

    // --- APPLIED ---
    {
      comp: "datadog",
      title: "Senior Distributed Tracing Engineer",
      desc: "Build real-time observability dashboards and streaming trace telemetry engines processing millions of events per second.",
      loc: "New York, NY",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 185000,
      max: 225000,
      salary: "$185,000 - $225,000",
      skills: ["TypeScript", "React", "Distributed Tracing", "Data Visualization", "Pino Logging"],
      listId: appliedId,
      pos: 1,
      tier: "1",
      source: "Greenhouse",
      matchScore: 88,
      daysOffset: 12,
      note: `${DEMO_MARKER} Application submitted through Greenhouse portal. Follow-up scheduled in 5 days.`,
      contacts: [],
    },
    {
      comp: "cloudflare",
      title: "Staff Edge Platform Engineer",
      desc: "Engineer serverless Workers runtime primitives, KV caching layers, and ultra-fast Next.js OpenNext edge deployment systems.",
      loc: "San Francisco, CA",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 195000,
      max: 245000,
      salary: "$195,000 - $245,000",
      skills: ["Cloudflare Workers", "TypeScript", "V8 Isolates", "Edge Caching", "Next.js"],
      listId: appliedId,
      pos: 2,
      tier: "1",
      source: "Careers Page",
      matchScore: 90,
      daysOffset: 15,
      note: `${DEMO_MARKER} Applied directly via Cloudflare career page. Highlighted serverless edge streaming experience.`,
      contacts: [],
    },
    {
      comp: "airbnb",
      title: "Senior Full Stack UI Engineer",
      desc: "Deliver accessible guest and host booking platforms with design system consistency and lightning-fast page responsiveness.",
      loc: "San Francisco, CA (Remote)",
      type: "Full-time",
      workLoc: "Remote",
      min: 180000,
      max: 220000,
      salary: "$180,000 - $220,000",
      skills: ["React 19", "TypeScript", "GraphQL", "Accessibility", "Design Systems"],
      listId: appliedId,
      pos: 3,
      tier: "1",
      source: "LinkedIn",
      matchScore: 87,
      daysOffset: 18,
      note: `${DEMO_MARKER} Applied on LinkedIn Easy Apply. Portfolio linked with live Next.js interactive showcases.`,
      contacts: [],
    },
    {
      comp: "netflix",
      title: "Senior Microservices & Streaming Architect",
      desc: "Build fault-tolerant UI platform services and streaming telemetry pipelines used by hundreds of millions of viewers worldwide.",
      loc: "Los Gatos, CA",
      type: "Full-time",
      workLoc: "On-site",
      min: 240000,
      max: 300000,
      salary: "$240,000 - $300,000",
      skills: ["Node.js", "TypeScript", "Distributed Systems", "gRPC", "Telemetry"],
      listId: appliedId,
      pos: 4,
      tier: "1",
      source: "Netflix Jobs",
      matchScore: 92,
      daysOffset: 16,
      note: `${DEMO_MARKER} Top-of-market compensation track. Reviewing distributed fault-tolerance design case studies.`,
      contacts: [],
    },

    // --- INTERVIEW ---
    {
      comp: "stripe",
      title: "Staff Frontend Architect",
      desc: "Design and build next-generation payment interfaces and design systems. Deep experience in TypeScript, React 19, web performance optimization, and accessible UI engineering.",
      loc: "San Francisco, CA (Remote)",
      type: "Full-time",
      workLoc: "Remote",
      min: 210000,
      max: 260000,
      salary: "$210,000 - $260,000",
      skills: ["TypeScript", "React 19", "Design Systems", "Web Performance", "Accessibility"],
      listId: interviewId,
      pos: 1,
      tier: "1",
      source: "LinkedIn Reachout",
      matchScore: 96,
      daysOffset: 4,
      note: `${DEMO_MARKER} Passed initial technical screen with Marcus Vance. Onsite architecture presentation scheduled next week with Patrick Collison and Principal Architect.`,
      contacts: ["patrick", "marcus"],
      hasInterview: true,
      interviewType: "technical",
      interviewTitle: "Frontend Architecture & High-Throughput Web Systems",
      interviewWith: "Marcus Vance & Staff Panel",
      interviewEmail: "mvance@stripe.demo",
      interviewOffsetDays: 3,
      duration: 60,
    },
    {
      comp: "anthropic",
      title: "Senior Alignment Tooling Engineer",
      desc: "Develop mission-critical evaluation platforms, prompt benchmarking harnesses, and safety-gated AI autonomy connectors for Claude 3.7 Sonnet.",
      loc: "San Francisco, CA",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 225000,
      max: 275000,
      salary: "$225,000 - $275,000",
      skills: ["TypeScript", "Claude API", "Safety Evals", "React", "Python", "Tool Use Protocols"],
      listId: interviewId,
      pos: 2,
      tier: "1",
      source: "David Lin Reachout",
      matchScore: 95,
      daysOffset: 3,
      note: `${DEMO_MARKER} Technical system design round confirmed with Dario Amodei and lead interpretability researcher.`,
      contacts: ["dario", "david"],
      hasInterview: true,
      interviewType: "panel",
      interviewTitle: "Constitutional AI Tooling & Permission Staging Architecture",
      interviewWith: "Dario Amodei & Alignment Lead",
      interviewEmail: "dlin@anthropic.demo",
      interviewOffsetDays: 2,
      duration: 60,
    },
    {
      comp: "linear",
      title: "Full Stack Platform Engineer",
      desc: "Build high-performance client applications with local-first SQLite sync, real-time collaboration, and fluid keyboard-driven workflows.",
      loc: "San Francisco, CA",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 180000,
      max: 220000,
      salary: "$180,000 - $220,000",
      skills: ["TypeScript", "SQLite", "React", "Real-Time Sync", "Keyboard UX", "WebSockets"],
      listId: interviewId,
      pos: 3,
      tier: "1",
      source: "Karri Saarinen Reachout",
      matchScore: 94,
      daysOffset: 5,
      note: `${DEMO_MARKER} Live coding challenge passed with flying colors. Deep dive interview on local SQLite synchronization mechanics.`,
      contacts: ["karri"],
      hasInterview: true,
      interviewType: "technical",
      interviewTitle: "Offline-First Sync & Keyboard-Driven Desktop UX",
      interviewWith: "Karri Saarinen",
      interviewEmail: "karri@linear.demo",
      interviewOffsetDays: 5,
      duration: 45,
    },
    {
      comp: "vercel",
      title: "Senior Cloud Systems Engineer",
      desc: "Scale Next.js Edge infrastructure and build developer-facing telemetry, streaming SSR pipelines, and zero-config deployment workflows.",
      loc: "Remote, Worldwide",
      type: "Full-time",
      workLoc: "Remote",
      min: 190000,
      max: 235000,
      salary: "$190,000 - $235,000",
      skills: ["Next.js 16", "Edge Computing", "TypeScript", "Streaming SSR", "Turbopack"],
      listId: interviewId,
      pos: 4,
      tier: "1",
      source: "Guillermo Rauch Reachout",
      matchScore: 93,
      daysOffset: 2,
      note: `${DEMO_MARKER} Recruiter screen & technical rounds passed. Final discussion with Guillermo Rauch on Next.js ecosystem future.`,
      contacts: ["guillermo", "aiden"],
      hasInterview: true,
      interviewType: "behavioral",
      interviewTitle: "Next.js Architecture & Developer Experience Vision",
      interviewWith: "Guillermo Rauch & Aiden Thorne",
      interviewEmail: "rauchg@vercel.demo",
      interviewOffsetDays: -2, // completed past interview
      duration: 45,
      isCompleted: true,
    },

    // --- OFFER ---
    {
      comp: "anthropic",
      title: "Staff AI Applications Engineer",
      desc: "Lead the developer platform team building high-fidelity client applications and multi-modal tool integration frameworks for Claude Enterprise.",
      loc: "San Francisco, CA",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 245000,
      max: 290000,
      salary: "$245,000 - $290,000",
      skills: ["TypeScript", "Claude 3.7", "Multi-Agent Architectures", "React 19", "Security Sandboxing"],
      listId: offerId,
      pos: 1,
      tier: "1",
      source: "Direct Talent Executive",
      matchScore: 98,
      daysOffset: 7,
      note: `${DEMO_MARKER} Formal written offer received: $265,000 base + 0.15% equity + $50k sign-on bonus. Decision deadline in 7 days.`,
      contacts: ["dario", "david"],
      isOffer: true,
    },
    {
      comp: "supabase",
      title: "Lead Frontend Infrastructure Engineer",
      desc: "Direct architectural roadmap for Supabase Studio, query builders, real-time database visualizers, and open-source design primitives.",
      loc: "Remote, Worldwide",
      type: "Full-time",
      workLoc: "Remote",
      min: 210000,
      max: 240000,
      salary: "$210,000 - $240,000",
      skills: ["TypeScript", "React", "Postgres UI", "Open Source", "Design Systems"],
      listId: offerId,
      pos: 2,
      tier: "1",
      source: "Leo Zhang Reachout",
      matchScore: 96,
      daysOffset: 10,
      note: `${DEMO_MARKER} Offer received: $225,000 base + equity + 100% remote flexibility. Comparing with Anthropic package.`,
      contacts: ["leo"],
      isOffer: true,
    },

    // --- REJECTED / ARCHIVED ---
    {
      comp: "airbnb",
      title: "Staff Design Systems Engineer",
      desc: "Architect core React component primitives and cross-platform design token synchronization systems.",
      loc: "San Francisco, CA",
      type: "Full-time",
      workLoc: "Hybrid",
      min: 200000,
      max: 245000,
      salary: "$200,000 - $245,000",
      skills: ["Design Systems", "TypeScript", "React", "Accessibility", "Figma API"],
      listId: rejectedId,
      pos: 1,
      tier: "1",
      source: "Job Board",
      matchScore: 84,
      daysOffset: 35,
      note: `${DEMO_MARKER} Headcount paused for Q2. Recruiter requested keeping in touch for upcoming Q3 expansion.`,
      contacts: [],
      isRejected: true,
    },
    {
      comp: "microsoft",
      title: "Senior Cloud Platform Engineer",
      desc: "Build Azure serverless developer portals and enterprise identity integration systems.",
      loc: "Redmond, WA (Remote)",
      type: "Full-time",
      workLoc: "Remote",
      min: 175000,
      max: 215000,
      salary: "$175,000 - $215,000",
      skills: ["TypeScript", "Azure", "Cloud Infrastructure", "React", "OAuth 2.0"],
      listId: rejectedId,
      pos: 2,
      tier: "1",
      source: "LinkedIn",
      matchScore: 81,
      daysOffset: 40,
      note: `${DEMO_MARKER} Role closed in favor of internal transfer. Constructive feedback provided on distributed architecture.`,
      contacts: [],
      isRejected: true,
    },
  ];

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

  const insertJobContactStmt = db.prepare(
    "INSERT OR IGNORE INTO job_contacts (job_id, contact_id) VALUES (?, ?)"
  );

  const insertInterviewStmt = db.prepare(
    `INSERT INTO interviews (
      id, user_id, job_id, scheduled_at, type, location, meeting_url,
      interviewer_name, interviewer_email, prep_notes, status, duration_minutes
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )`
  );

  const insertAppStmt = db.prepare(
    `INSERT OR IGNORE INTO applications (
      id, user_id, job_id, status, applied_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insertDeadlineStmt = db.prepare(
    `INSERT OR IGNORE INTO job_deadlines (
      id, user_id, job_id, title, type, stage_kind, due_date, is_completed, is_pinned, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const jobIds: string[] = [];

  for (const j of jobDefs) {
    const jobId = randomUUID();
    jobIds.push(jobId);
    const compId = companyMap.get(j.comp) || null;
    const deadlineDate = new Date(now.getTime() + j.daysOffset * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const notesJson = JSON.stringify([
      {
        id: randomUUID(),
        title: "Key Milestones",
        bullets: [j.note],
      },
    ]);

    insertJobStmt.run(
      jobId,
      userId,
      compId,
      j.title,
      j.desc,
      j.loc,
      j.type,
      j.salary,
      j.min,
      j.max,
      "USD",
      "yearly",
      j.workLoc,
      JSON.stringify(j.skills),
      j.listId ?? null,
      j.pos,
      primaryPosId,
      notesJson,
      j.tier,
      j.source,
      j.matchScore,
      deadlineDate
    );

    // Bind Contacts
    for (const cKey of j.contacts) {
      const contactId = contactMap.get(cKey);
      if (contactId) {
        insertJobContactStmt.run(jobId, contactId);
      }
    }

    // Bind Deadlines
    const stageKind = j.isOffer ? "offer" : j.hasInterview ? "interview" : j.isRejected ? "rejected" : "applied";
    const deadlineTitle = j.isOffer
      ? "Offer Decision Deadline"
      : j.hasInterview
      ? (j.interviewTitle || "Upcoming Interview Round")
      : "Application Review Target";

    insertDeadlineStmt.run(
      randomUUID(),
      userId,
      jobId,
      deadlineTitle,
      "deadline",
      stageKind,
      deadlineDate,
      j.isCompleted ? 1 : 0,
      j.tier === "1" ? 1 : 0,
      `${DEMO_MARKER} ${j.note}`
    );

    // Bind Applications for applied, interview, offer, rejected stages
    if (j.listId === appliedId || j.listId === interviewId || j.listId === offerId || j.listId === rejectedId) {
      const appStatus = j.isOffer ? "offer" : j.hasInterview ? "interview" : j.isRejected ? "rejected" : "applied";
      const appliedDaysAgo = Math.max(1, Math.abs(j.daysOffset));
      const appliedDate = new Date(now.getTime() - appliedDaysAgo * 24 * 60 * 60 * 1000).toISOString();

      insertAppStmt.run(
        randomUUID(),
        userId,
        jobId,
        appStatus,
        appliedDate,
        `${DEMO_MARKER} Application tracked: ${j.source}. ${j.note}`
      );
    }

    // Bind Interview
    if (j.hasInterview) {
      const interviewDate = new Date(now.getTime() + (j.interviewOffsetDays || 3) * 24 * 60 * 60 * 1000);
      insertInterviewStmt.run(
        randomUUID(),
        userId,
        jobId,
        interviewDate.toISOString(),
        j.interviewType || "technical",
        "Google Meet",
        "https://meet.google.com/demo-attrack",
        j.interviewWith || "Engineering Lead",
        j.interviewEmail || "recruiter@company.demo",
        `${DEMO_MARKER} Comprehensive review of architecture, system scalability, and technical leadership.`,
        j.isCompleted ? "completed" : "scheduled",
        j.duration || 45
      );
    }
  }

  // 5. Seed Resources, Link Categories & Quick Shortcuts
  try {
    seedDemoResources(userId);
  } catch (err) {
    log.warn({ err }, "Could not seed demo resources/links");
  }

  // Refresh FTS5 omni search
  rebuildOmniSearchIndex(db);

  return {
    jobIds,
    companyIds,
    contactIds,
  };
}

/** Seeds rich link categories, portal links, and quick shortcuts */
function seedDemoResources(userId: string) {
  const db = getDb();

  const categories = [
    { name: "Recruitment Portals", order: 1 },
    { name: "Career Pages", order: 2 },
    { name: "Tech News & Engineering Prep", order: 3 },
  ];

  const catMap = new Map<string, string>();
  for (const c of categories) {
    const existing = db
      .prepare("SELECT id FROM link_categories WHERE user_id = ? AND name = ?")
      .get(userId, c.name) as { id: string } | undefined;

    let catId = existing?.id;
    if (!catId) {
      catId = randomUUID();
      db.prepare(
        "INSERT INTO link_categories (id, user_id, name, sort_order, is_default) VALUES (?, ?, ?, ?, 1)"
      ).run(catId, userId, c.name, c.order);
    }
    catMap.set(c.name, catId);
  }

  const links = [
    // Recruitment Portals
    { cat: "Recruitment Portals", title: "LinkedIn Jobs Portal", url: "https://linkedin.com/jobs", icon: "Briefcase" },
    { cat: "Recruitment Portals", title: "Wellfound (AngelList)", url: "https://wellfound.com/jobs", icon: "Rocket" },
    { cat: "Recruitment Portals", title: "Y Combinator Work at a Startup", url: "https://workatastartup.com", icon: "TrendingUp" },
    { cat: "Recruitment Portals", title: "Otta (Welcome to the Jungle)", url: "https://otta.com", icon: "Compass" },
    { cat: "Recruitment Portals", title: "Greenhouse Candidate Portal", url: "https://job-boards.greenhouse.io", icon: "CheckCircle" },

    // Career Pages
    { cat: "Career Pages", title: "OpenAI Careers", url: "https://openai.com/careers", icon: "Sparkles" },
    { cat: "Career Pages", title: "Anthropic Careers", url: "https://anthropic.com/careers", icon: "Shield" },
    { cat: "Career Pages", title: "Stripe Jobs", url: "https://stripe.com/jobs", icon: "CreditCard" },
    { cat: "Career Pages", title: "Linear Careers", url: "https://linear.app/careers", icon: "Layers" },
    { cat: "Career Pages", title: "Vercel Careers", url: "https://vercel.com/careers", icon: "Globe" },
    { cat: "Career Pages", title: "Supabase Careers", url: "https://supabase.com/careers", icon: "Database" },

    // Tech News & Engineering Prep
    { cat: "Tech News & Engineering Prep", title: "The Pragmatic Engineer", url: "https://newsletter.pragmaticengineer.com", icon: "BookOpen" },
    { cat: "Tech News & Engineering Prep", title: "Hacker News", url: "https://news.ycombinator.com", icon: "Terminal" },
    { cat: "Tech News & Engineering Prep", title: "Levels.fyi (Compensation Benchmarks)", url: "https://levels.fyi", icon: "DollarSign" },
    { cat: "Tech News & Engineering Prep", title: "System Design Primer", url: "https://github.com/donnemartin/system-design-primer", icon: "Cpu" },
  ];

  const insertLinkStmt = db.prepare(
    `INSERT OR IGNORE INTO links (id, user_id, category_id, title, url, notes, icon_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const nowIso = new Date().toISOString();
  for (const l of links) {
    const catId = catMap.get(l.cat);
    if (catId) {
      insertLinkStmt.run(
        randomUUID(),
        userId,
        catId,
        `${DEMO_MARKER} ${l.title}`,
        l.url,
        `${DEMO_MARKER} Quick access link for career workflows`,
        null,
        nowIso,
        nowIso
      );
    }
  }

  // Quick Shortcuts
  const shortcuts = [
    { title: "Portfolio Website", text: "https://alexchen.dev", icon: "link", order: 1 },
    { title: "GitHub Profile", text: "https://github.com/alexchen-dev", icon: "link", order: 2 },
    { title: "LinkedIn URL", text: "https://linkedin.com/in/alexchen-dev", icon: "link", order: 3 },
    { title: "Calendly 30min Loop", text: "https://calendly.com/alexchen/30min", icon: "link", order: 4 },
    { title: "Pitch / Elevator Bio", text: "Staff Frontend Architect with 8+ years experience scaling React 19, local-first SQLite, and high-performance Web systems.", icon: "link", order: 5 },
  ];

  const insertShortcutStmt = db.prepare(
    `INSERT OR IGNORE INTO quick_shortcuts (id, user_id, title, value, icon, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const s of shortcuts) {
    insertShortcutStmt.run(randomUUID(), userId, `${DEMO_MARKER} ${s.title}`, s.text, s.icon, s.order, nowIso, nowIso);
  }
}

/**
 * Cleanly removes all demo/sample records created during onboarding
 * without affecting user's own data in a single clean pass.
 */
export function deleteSampleData(userId: string): { removedCount: number } {
  const db = getDb();

  // 1. Find all demo jobs with DEMO_MARKER
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

  // 2. Delete demo contacts (and unbind job_contacts)
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

  // 3. Delete demo companies if they have no remaining non-demo jobs
  const sampleCompanyNames = [
    "OpenAI", "Anthropic", "Google DeepMind", "Stripe", "Apple", "Meta",
    "NVIDIA", "Microsoft", "Linear", "Vercel", "Figma", "Supabase",
    "GitHub", "Datadog", "Cloudflare", "Airbnb", "Netflix",
  ];

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

  // 4. Delete demo links & shortcuts tagged with DEMO_MARKER
  try {
    db.prepare("DELETE FROM links WHERE user_id = ? AND title LIKE ?").run(userId, `%${DEMO_MARKER}%`);
  } catch {}
  try {
    db.prepare("DELETE FROM quick_shortcuts WHERE user_id = ? AND title LIKE ?").run(userId, `%${DEMO_MARKER}%`);
  } catch {}

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
