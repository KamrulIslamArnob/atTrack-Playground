const EXTRACTION_RULES = `Rules:
- Return null for any field that cannot be clearly determined
- Use ONLY the following values for employment_type: "Full-time", "Part-time", "Contract", "Freelance", "Internship", "Temporary", "Apprenticeship", "Volunteer"
- Use ONLY the following values for work_location: "remote", "onsite", "hybrid"
- For notes, group related requirements or benefits into categories with bullet points
- Do not fabricate information that is not present in the source
- For application_url, include the full URL if visible
- For application_email, extract any email address mentioned for submitting applications
- For application_process, describe how to apply if the posting mentions email-based or manual application steps (e.g. "Send resume and cover letter to careers@example.com", "Email your application to HR with subject line 'Senior Developer Application'")
- For contact, only fill it in if the posting explicitly names a specific person (a recruiter, hiring manager, or point of contact) — a generic "careers@company.com" with no name attached is NOT a contact, leave contact null in that case. Never invent a name.

Return a JSON object with these fields:
{
  "title": "string or null",
  "company": "string or null",
  "location": "string or null",
  "salary_range": "string or null",
  "employment_type": "string or null",
  "work_location": "remote | onsite | hybrid or null",
  "description": "string or null",
  "application_url": "string or null",
  "application_email": "string (email) or null",
  "application_process": "string (how to apply via email/manual) or null",
  "source": "string or null",
  "deadline": "string or null (YYYY-MM-DD format if found)",
  "notes": [{"title": "string", "bullets": ["string"]}] or null,
  "contact": {"name": "string or null", "email": "string or null", "role": "string or null (e.g. Recruiter, Hiring Manager)"} or null
}`;

// One job posting can arrive as screenshot(s), pasted text, or both together —
// the caller decides what's provided, this prompt just tells the model to use
// whatever it's given.
export const EXTRACTION_PROMPT = `You are a job posting data extractor. You may be given one or more screenshots of a job posting, pasted text of the posting, or both together — use every source provided and merge them into one complete, accurate result. If sources overlap, prefer the more specific/complete value; don't drop a field that only one source mentions.

${EXTRACTION_RULES}`;
