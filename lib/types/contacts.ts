// Fixed relationship list for CRM contacts — lets the CRM group/filter a
// company's roster by relationship instead of relying on free text.

export const CONTACT_ROLES = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "employee", label: "Employee" },
  { value: "alumni", label: "Alumni" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;

export type ContactRole = (typeof CONTACT_ROLES)[number]["value"];

export function contactRoleLabel(role: string | null): string {
  return CONTACT_ROLES.find((r) => r.value === role)?.label ?? "Other";
}
