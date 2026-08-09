// Run with: node lib/mentions.selfcheck.ts
// Plain asserts, no framework — matches lib/db/selfcheck.ts's convention.

import assert from "node:assert/strict";

const { parseNoteMentions, insertMentionToken } = await import("./mentions.ts");

// Plain text, no mention.
assert.deepEqual(parseNoteMentions("Met at the career fair."), [
  { text: "Met at the career fair." },
]);

// Mention in the middle.
const token = insertMentionToken("Frontend Engineer", "job-123");
assert.equal(token, "@[Frontend Engineer](job:job-123)");
assert.deepEqual(parseNoteMentions(`Referred me for ${token} last week.`), [
  { text: "Referred me for " },
  { text: "Frontend Engineer", jobId: "job-123" },
  { text: " last week." },
]);

// Mention at the very start and very end, two mentions.
const a = insertMentionToken("A", "1");
const b = insertMentionToken("B", "2");
assert.deepEqual(parseNoteMentions(`${a} and ${b}`), [
  { text: "A", jobId: "1" },
  { text: " and " },
  { text: "B", jobId: "2" },
]);

// Empty note.
assert.deepEqual(parseNoteMentions(""), []);

console.log("lib/mentions.ts self-check: all assertions passed");
