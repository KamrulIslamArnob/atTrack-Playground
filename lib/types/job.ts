export interface JobNote {
  id: string;
  title: string;
  bullets: string[];
}

export interface JobFormData {
  title: string;
  company: string;
  application_url: string | null;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  deadline: string | null;
  source: string | null;
  description: string | null;
  status: string;
  notes: JobNote[];
}

export interface ExtractionResult {
  title: string | null;
  company: string | null;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  description: string | null;
  application_url: string | null;
  source: string | null;
  deadline: string | null;
  notes: Array<{ title: string; bullets: string[] }> | null;
}
