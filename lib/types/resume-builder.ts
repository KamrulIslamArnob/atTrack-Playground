// Plain types for the resume builder. No runtime code — the inline-markup
// parser (lib/resume/inline.ts), the LaTeX emitter, and the HTML renderer are
// all later tasks; this file only defines the shape they share.

export type BadgeKind = "live" | "repo" | "api" | "cred" | "port";
export type ChipKind = "cat" | "type";
export type ContactIcon = "github" | "linkedin" | "mappin" | "envelope" | "phone" | "globe";

/** A pill in the header. `variant` picks the LaTeX macro: portbtn vs contactbtn. */
export interface ResumeLink {
  id: string;
  variant: "port" | "contact";
  icon: ContactIcon;
  label: string;
  /** Absent -> rendered as a plain pill with no link (e.g. the "Dhaka" location pill). */
  url?: string;
}

export interface ResumeHeader {
  name: string;
  title: string;
  summary: string;
  /** Right side of row 1 (next to the name). */
  topLinks: ResumeLink[];
  /** Right side of row 2 (next to the job title). */
  bottomLinks: ResumeLink[];
}

/** Maps to \resumeSubheading{left1}{right1}{left2}{right2}. Used by Experience + Education. */
export interface SubheadingEntry {
  id: string;
  left1: string;   // org / school      — bold black
  right1: string;  // meta / GPA        — bold dark grey, inline-parsed
  left2: string;   // role / degree     — italic small
  right2: string;  // dates             — italic small
  bullets: string[];  // inline-parsed
}

/** Maps to \resumeProjectHeading{left}{right}. Used by Projects, Training, Awards,
 *  Certifications, Leadership. */
export interface ProjectEntry {
  id: string;
  left: string;    // inline-parsed
  right: string;   // inline-parsed (badges, or a year)
  bullets: string[];  // inline-parsed
  /** Unbulleted small paragraph under the heading (\item[] in the reference).
   *  Only Professional Training uses it. */
  note?: string;
}

export interface SkillRow {
  id: string;
  label: string;   // "Languages & Frameworks"
  value: string;   // inline-parsed, may contain [cat](...) chips
}

export interface SectionState { visible: boolean }

export interface ResumeDoc {
  header: ResumeHeader;
  experience:     SectionState & { entries: SubheadingEntry[] };
  skills:         SectionState & { rows: SkillRow[]; callout: string };
  projects:       SectionState & { entries: ProjectEntry[] };
  education:      SectionState & { entries: SubheadingEntry[] };
  training:       SectionState & { entries: ProjectEntry[] };
  awards:         SectionState & { entries: ProjectEntry[] };
  certifications: SectionState & { entries: ProjectEntry[] };
  leadership:     SectionState & { entries: ProjectEntry[] };
}

/** Fixed order + display titles. Never reordered or renamed. */
export const SECTION_ORDER = [
  ["experience",     "Work Experience"],
  ["skills",         "Skills"],
  ["projects",       "Projects"],
  ["education",      "Education"],
  ["training",       "Professional Training"],
  ["awards",         "Honors & Awards"],
  ["certifications", "Certifications"],
  ["leadership",     "Leadership"],
] as const;
