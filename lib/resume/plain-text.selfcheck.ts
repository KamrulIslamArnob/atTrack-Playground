// Run with: node lib/resume/plain-text.selfcheck.ts
// Plain asserts, no framework — matches lib/db/selfcheck.ts's convention.

import assert from "node:assert/strict";

const { resumeToPlainText } = await import("./plain-text.ts");
const { seedResumeDoc } = await import("./seed.ts");

// Markup is stripped: no **, no *, no [kind](...) badge/chip syntax left.
const seeded = resumeToPlainText(seedResumeDoc());
assert.ok(!seeded.includes("**"), "no bold markers left");
assert.ok(!/\[(?:live|repo|api|cred|port|cat|type)\]\(/.test(seeded), "no badge/chip syntax left");
assert.ok(seeded.includes("Master of Content & Creativity 2025"), "badge label survives, quotes intact");
assert.ok(seeded.includes("phitron.io"), "live badge reduced to its label");
assert.ok(seeded.includes("RDBMS"), "cat chip reduced to its label");
assert.ok(seeded.includes("Work Experience"), "section title present");
assert.ok(seeded.includes("Kamrul Islam Arnob"), "header name present");

// Section order is respected and hidden sections are omitted.
const withHiddenSkills = seedResumeDoc();
withHiddenSkills.skills.visible = false;
const text = resumeToPlainText(withHiddenSkills);
assert.ok(!text.includes("Skills"), "hidden section omitted");
assert.ok(text.indexOf("Work Experience") < text.indexOf("Projects"), "section order preserved");

// A minimal doc round-trips without throwing on empty arrays/optional fields.
const minimal = seedResumeDoc();
minimal.education.entries = [];
minimal.training.entries[0].note = undefined;
assert.doesNotThrow(() => resumeToPlainText(minimal));

console.log("lib/resume/plain-text.ts self-check: all assertions passed");
