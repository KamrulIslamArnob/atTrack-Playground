export interface Skill {
  id: string;
  user_id: string;
  name: string;
  command: string;
  description: string | null;
  instructions: string;
  icon?: string;
  is_builtin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSkillInput {
  name: string;
  command: string;
  description?: string | null;
  instructions: string;
  icon?: string;
}

export interface UpdateSkillInput {
  name: string;
  command: string;
  description?: string | null;
  instructions: string;
  icon?: string;
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "builtin-resume",
    user_id: "system",
    name: "Resume & ATS Optimizer",
    command: "resume",
    description: "Analyze resume for ATS keywords, quantifiable impact, and STAR formatting",
    instructions:
      "Review my resume and recent experience. Suggest quantifiable bullet points using the Action-Verb + Task + Measurable Impact (STAR) formula, identify missing industry keywords, and optimize formatting for ATS parsing.",
    icon: "FileText",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-cover",
    user_id: "system",
    name: "Targeted Cover Letter",
    command: "cover",
    description: "Draft a compelling, customized cover letter tailored to a specific job and company",
    instructions:
      "Draft a concise, tailored cover letter for this role. Highlight relevant achievements, connect my background directly with company goals, and maintain a confident, professional tone without generic filler.",
    icon: "Mail",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-interview",
    user_id: "system",
    name: "STAR Mock Interviewer",
    command: "interview",
    description: "Conduct a realistic technical or behavioral mock interview with instant feedback",
    instructions:
      "Act as an expert tech hiring manager. Ask me ONE realistic interview question at a time relevant to my target role. Wait for my response, evaluate it using the STAR method, give constructive feedback, and then ask the next question.",
    icon: "UserCheck",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-outreach",
    user_id: "system",
    name: "Cold Recruiter Outreach",
    command: "outreach",
    description: "Craft high-converting LinkedIn and email outreach messages to recruiters and founders",
    instructions:
      "Draft 2 concise outreach message variants (one LinkedIn InMail under 100 words, one short email) to a recruiter or hiring manager expressing interest in the role with a clear hook and low-friction call to action.",
    icon: "Send",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-salary",
    user_id: "system",
    name: "Salary Negotiation Coach",
    command: "salary",
    description: "Formulate strategic counter-offers and negotiation scripts for job offers",
    instructions:
      "Help me evaluate this compensation package (base, equity, bonus, benefits). Provide market benchmark comparisons, strategic leverage points, and word-for-word email and phone negotiation scripts.",
    icon: "DollarSign",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-code",
    user_id: "system",
    name: "Code Review & Optimization",
    command: "code",
    description: "Review code snippets for performance, architectural cleanliness, and edge cases",
    instructions:
      "Review the provided code for performance bottlenecks, TypeScript safety, edge case handling, and modern clean code patterns. Suggest precise drop-in improvements with explanations.",
    icon: "Code2",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-job",
    user_id: "system",
    name: "Job Fit & Gap Analysis",
    command: "job",
    description: "Evaluate job requirements against my background and identify strengths and gaps",
    instructions:
      "Compare my experience, skills, and projects against this job description. Generate a Match Score (0-100), key alignment points, potential skill gaps with quick bridging strategies, and talking points for interviews.",
    icon: "Briefcase",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-network",
    user_id: "system",
    name: "Networking Strategy",
    command: "network",
    description: "Plan referral outreach and coffee chat preparation with industry contacts",
    instructions:
      "Help me plan an effective networking approach for this company/industry. Draft a connection note, 3 thoughtful coffee chat questions, and a structured follow-up plan to ask for a referral naturally.",
    icon: "Users",
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];
