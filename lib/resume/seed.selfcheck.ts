// Run with: node lib/resume/seed.selfcheck.ts
// Plain asserts, no framework — matches lib/db/selfcheck.ts's convention.
//
// Asserts the completeness counts from task-1-brief.md so a future edit that
// silently drops content fails loudly, and that seedResumeDoc() returns a
// fresh object each call (never a shared mutable singleton).

import assert from "node:assert/strict";

const { seedResumeDoc } = await import("./seed.ts");

const doc = seedResumeDoc();

// All 8 sections start visible.
for (const key of [
  "experience", "skills", "projects", "education",
  "training", "awards", "certifications", "leadership",
] as const) {
  assert.equal(doc[key].visible, true, `${key}.visible`);
}

assert.equal(doc.experience.entries.length, 1, "1 experience entry");
assert.equal(doc.experience.entries[0].bullets.length, 3, "3 experience bullets");

assert.equal(doc.skills.rows.length, 6, "6 skill rows");
assert.ok(doc.skills.callout.length > 0, "1 skills callout");

assert.equal(doc.projects.entries.length, 3, "3 projects");
for (const p of doc.projects.entries) assert.equal(p.bullets.length, 1, "1 bullet per project");

assert.equal(doc.education.entries.length, 3, "3 education entries");
assert.equal(doc.education.entries[0].bullets.length, 2, "2 bullets on first education entry");
assert.equal(doc.education.entries[1].bullets.length, 0, "0 bullets on second education entry");
assert.equal(doc.education.entries[2].bullets.length, 0, "0 bullets on third education entry");

assert.equal(doc.training.entries.length, 1, "1 training entry");
assert.ok(doc.training.entries[0].note && doc.training.entries[0].note.length > 0, "training entry has a note");
assert.equal(doc.training.entries[0].bullets.length, 0, "training entry has no bullets");

assert.equal(doc.awards.entries.length, 4, "4 awards");
assert.equal(doc.certifications.entries.length, 3, "3 certifications");
assert.equal(doc.leadership.entries.length, 5, "5 leadership entries");

// Header, verbatim per the brief.
assert.equal(doc.header.name, "Kamrul Islam Arnob");
assert.equal(doc.header.title, "Software Engineer");
assert.equal(doc.header.topLinks.length, 4, "4 top links");
assert.equal(doc.header.bottomLinks.length, 2, "2 bottom links");
assert.equal(doc.header.topLinks.find((l) => l.label === "Dhaka")?.url, undefined, "Dhaka pill has no url");

// Fresh object every call: distinct ids, mutating one copy leaves the next untouched.
const doc2 = seedResumeDoc();
assert.notEqual(doc.experience.entries[0].id, doc2.experience.entries[0].id, "ids differ across calls");
doc.header.name = "mutated";
assert.equal(doc2.header.name, "Kamrul Islam Arnob", "second call unaffected by mutating the first");

console.log("lib/resume/seed.ts self-check: all assertions passed");
