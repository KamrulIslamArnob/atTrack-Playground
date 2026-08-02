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
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
