// A contact's note can embed a link to a saved job, written inline as
// @[Job Title](job:jobId) — no separate mentions table, the token lives in
// the plain-text `notes` column. This module is the only place that knows
// the token's shape: writers call insertMentionToken, readers call
// parseNoteMentions.

const MENTION_PATTERN = /@\[([^\]]+)\]\(job:([^)]+)\)/g;

export interface NoteSegment {
  text: string;
  /** Present only on the segment that is a mention; absent on plain text. */
  jobId?: string;
}

export function insertMentionToken(jobTitle: string, jobId: string): string {
  return `@[${jobTitle}](job:${jobId})`;
}

export function parseNoteMentions(note: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let lastIndex = 0;

  for (const match of note.matchAll(MENTION_PATTERN)) {
    const [full, title, jobId] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: note.slice(lastIndex, index) });
    segments.push({ text: title, jobId });
    lastIndex = index + full.length;
  }

  if (lastIndex < note.length) segments.push({ text: note.slice(lastIndex) });
  return segments;
}
