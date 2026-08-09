/**
 * Self-check for the AI provider dispatch engine — pure logic only: fallback
 * chain ordering/error handling (via a fake resolveCaller, no real provider
 * APIs are called) and HTML stripping. No test framework — plain asserts,
 * matching lib/db/selfcheck.ts's established convention.
 *
 * Run with: node lib/ai/providers.selfcheck.ts
 */
import assert from "node:assert/strict";
import { runChain, stripHtml, type ResolvedProvider, type GenerateTextResult, type HopCaller } from "./providers.ts";

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`  ok  ${label}`);
}

function provider(id: string): ResolvedProvider {
  return {
    id,
    name: id,
    provider_type: "openai_compatible",
    base_url: "https://example.test",
    model: "test-model",
    api_key: "x",
  };
}

const noLog = { action: "selfcheck" }; // no userId -> runChain never touches the DB

// ---------- first hop succeeds: no fallback attempted ----------
{
  const calls: string[] = [];
  const fakeCaller: HopCaller = async (p): Promise<GenerateTextResult> => {
    calls.push(p.id);
    return { text: `from ${p.id}`, providerName: p.name, model: p.model };
  };

  const result = await runChain([provider("a"), provider("b")], { userPrompt: "hi" }, noLog, () => fakeCaller);
  assert.equal(result.text, "from a");
  assert.deepEqual(calls, ["a"]);
  ok("first hop success short-circuits the chain");
}

// ---------- first hop fails, second succeeds ----------
{
  const calls: string[] = [];
  const fakeCaller: HopCaller = async (p): Promise<GenerateTextResult> => {
    calls.push(p.id);
    if (p.id === "a") throw new Error("boom");
    return { text: `from ${p.id}`, providerName: p.name, model: p.model };
  };

  const result = await runChain([provider("a"), provider("b")], { userPrompt: "hi" }, noLog, () => fakeCaller);
  assert.equal(result.text, "from b");
  assert.deepEqual(calls, ["a", "b"]);
  ok("first-hop failure falls through to the second hop");
}

// ---------- every hop fails ----------
{
  const fakeCaller: HopCaller = async () => {
    throw new Error("nope");
  };

  await assert.rejects(
    () => runChain([provider("a"), provider("b")], { userPrompt: "hi" }, noLog, () => fakeCaller),
    /All providers failed: a: nope; b: nope/
  );
  ok("exhausted chain throws a combined error");
}

// ---------- empty chain ----------
{
  await assert.rejects(
    () => runChain([], { userPrompt: "hi" }, noLog, () => (async () => ({ text: "", providerName: "", model: "" })) as HopCaller),
    /No AI provider configured/
  );
  ok("empty chain throws immediately");
}

// ---------- stripHtml ----------
{
  const html = "<html><head><style>.a{color:red}</style></head><body><script>evil()</script><p>Hello&nbsp;World</p></body></html>";
  assert.equal(stripHtml(html), "Hello World");
  ok("stripHtml removes script/style/tags and collapses whitespace");
}

console.log(`\n${passed} checks passed.`);
