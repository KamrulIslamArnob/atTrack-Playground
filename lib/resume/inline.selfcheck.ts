// Run with: node lib/resume/inline.selfcheck.ts
// Plain asserts, no framework -- matches lib/db/selfcheck.ts's convention.
//
// Covers the 11 cases listed in .superpowers/sdd/task-2-brief.md, in order.

import assert from "node:assert/strict";

async function main() {
  const { parseInline } = await import("./inline.ts");
  const { seedResumeDoc } = await import("./seed.ts");

  let passed = 0;
  function check(label: string, fn: () => void) {
    fn();
    passed++;
    console.log(`  ok  ${label}`);
  }

check("1. plain text -> one text node", () => {
  assert.deepEqual(parseInline("hello world"), [{ type: "text", value: "hello world" }]);
});

check("2. **bold** -> one bold node containing one text node", () => {
  assert.deepEqual(parseInline("**bold**"), [
    { type: "bold", children: [{ type: "text", value: "bold" }] },
  ]);
});

check("3. *italic* -> one italic node", () => {
  assert.deepEqual(parseInline("*italic*"), [
    { type: "italic", children: [{ type: "text", value: "italic" }] },
  ]);
});

check("4. nesting: **a *b***", () => {
  assert.deepEqual(parseInline("**a *b***"), [
    {
      type: "bold",
      children: [
        { type: "text", value: "a " },
        { type: "italic", children: [{ type: "text", value: "b" }] },
      ],
    },
  ]);
});

check("5. unterminated **abc -> literal text, no throw", () => {
  assert.deepEqual(parseInline("**abc"), [{ type: "text", value: "**abc" }]);
});

check('6. [live](url "site") -> badge node with kind/label/url', () => {
  assert.deepEqual(parseInline('[live](https://x.com "site")'), [
    { type: "badge", kind: "live", label: "site", url: "https://x.com" },
  ]);
});

check("7. [cat](RDBMS) -> badge with kind cat, label RDBMS, no url", () => {
  assert.deepEqual(parseInline("[cat](RDBMS)"), [{ type: "badge", kind: "cat", label: "RDBMS" }]);
});

check("8. ' | ' at top level -> sep node", () => {
  assert.deepEqual(parseInline("a | b"), [
    { type: "text", value: "a" },
    { type: "sep" },
    { type: "text", value: "b" },
  ]);
});

check("9. *LangChain | LangGraph | Python* -> one italic node, pipes stay literal", () => {
  assert.deepEqual(parseInline("*LangChain | LangGraph | Python*"), [
    { type: "italic", children: [{ type: "text", value: "LangChain | LangGraph | Python" }] },
  ]);
});

check('10. parseInline("") -> []', () => {
  assert.deepEqual(parseInline(""), []);
});

check("11. a real bullet from the seed round-trips to the expected node kinds", () => {
  const bullet = seedResumeDoc().experience.entries[0].bullets[0];
  const nodes = parseInline(bullet);
  assert.deepEqual(
    nodes.map((n: { type: string }) => n.type),
    ["text", "bold", "text", "badge"],
    "node kinds"
  );
  const bold = nodes[1] as { type: "bold"; children: unknown[] };
  assert.deepEqual(bold.children, [{ type: "text", value: "Product Manager" }], "bold contents");
  const badge = nodes[3] as { type: "badge"; kind: string; label: string; url?: string };
  assert.equal(badge.kind, "live", "badge kind");
  assert.equal(badge.url, "https://phitron.io/", "badge url");
  assert.equal(badge.label, "phitron.io", "badge label");
});

  console.log(`\nlib/resume/inline.ts self-check: ${passed}/11 passed`);
}

main();
