import { z } from "zod";

export const extractionSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  salary_range: z.string().nullable(),
  employment_type: z
    .enum([
      "Full-time",
      "Part-time",
      "Contract",
      "Freelance",
      "Internship",
      "Temporary",
      "Apprenticeship",
      "Volunteer",
    ])
    .nullable(),
  work_location: z.enum(["remote", "onsite", "hybrid"]).nullable(),
  description: z.string().nullable(),
  application_url: z.string().url().nullable(),
  application_email: z.string().email().nullable(),
  application_process: z.string().nullable(),
  source: z.string().nullable(),
  deadline: z.string().nullable(),
  notes: z
    .array(
      z.object({
        title: z.string(),
        bullets: z.array(z.string()),
      })
    )
    .nullable(),
  // A recruiter/hiring-manager named in the posting, if any — feeds the CRM
  // (lib/actions/jobs.ts's createJob find-or-creates this contact under the
  // job's company and links it). Null when the posting doesn't name a person.
  contact: z
    .object({
      name: z.string().nullable(),
      email: z.string().email().nullable(),
      role: z.string().nullable(),
    })
    .nullable(),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
