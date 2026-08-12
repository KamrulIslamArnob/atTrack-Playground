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
  skills: z.array(z.string()).nullable().optional(),
  educational_requirements: z.string().nullable().optional(),
  benefits: z.array(z.string()).nullable().optional(),
  work_schedule: z.string().nullable().optional(),
  holiday_policy: z.string().nullable().optional(),
  map_url: z.string().nullable().optional(),
  is_unpaid: z.boolean().nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  salary_currency: z.string().nullable().optional(),
  salary_period: z.enum(["yearly", "monthly", "hourly"]).nullable().optional(),
  notes: z
    .array(
      z.object({
        title: z.string(),
        bullets: z.array(z.string()),
      })
    )
    .nullable(),
  contact: z
    .object({
      name: z.string().nullable(),
      email: z.string().email().nullable(),
      role: z.string().nullable(),
    })
    .nullable(),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
