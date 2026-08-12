// Inline markup parser shared by the LaTeX emitter (Task 3) and the HTML
// renderer (Task 4) -- the seam that keeps the exported .tex and the
// on-screen preview from drifting apart. Both renderers walk the exact same
// InlineNode[] this file produces; neither re-implements the grammar.
//
// Grammar (see .superpowers/sdd/task-2-brief.md):
//   **text**                                 bold
//   *text*                                   italic
//   " | " (space-pipe-space)                 separator, only outside emphasis
//   [live|repo|api|cred|port](url "label")   linked badge pill
//   [live|repo|api|cred|port](label)         unlinked badge pill (no anchor)
//   [cat|type](label)                        chip (never linked)
//   anything else                            literal text
//
// A hand-written scanner, not a regex-only implementation: bold and italic
// nest, and a single regex pass can't track "am I currently inside an
// emphasis run" across nesting depth -- which is exactly what's needed so
// ` | ` inside `*LangChain | LangGraph | Python*` stays literal text instead
// of splitting into separator nodes (see case 9 in the self-check).

// Relative import with an explicit .ts extension, matching lib/resume/plain-text.ts:
// this file is also loaded directly by `node lib/resume/inline.selfcheck.ts`,
// and plain node doesn't resolve the "@/..." path alias (only the bundler does).
import type { BadgeKind, ChipKind } from "../types/resume-builder.ts";

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "sep" }
  | { type: "badge"; kind: BadgeKind | ChipKind; label: string; url?: string };

const BADGE_STICKY_RE = /\[(live|repo|api|cred|port|cat|type)\]\(([^)]*)\)/y;
// The linked form'inner content is `url "label"` -- url is the run of
// non-whitespace before the quote, label is whatever's inside the quotes
// (may be empty, which is the "label omitted" case).
const LINKED_RE = /^(\S+)\s+"([^"]*)"$/;

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** Tries to match a badge token starting at `pos` without string allocation.
 *  Returns null (never throws) when `s[pos] === "["` isn't actually a recognized
 *  badge, e.g. an unknown kind or a missing closing paren. */
function matchBadge(s: string, pos: number): { node: InlineNode; next: number } | null {
  BADGE_STICKY_RE.lastIndex = pos;
  const m = BADGE_STICKY_RE.exec(s);
  if (!m) return null;
  const kind = m[1] as BadgeKind | ChipKind;
  const inner = m[2].trim();
  const linked = LINKED_RE.exec(inner);
  const node: InlineNode = linked
    ? { type: "badge", kind, label: linked[2] || hostOf(linked[1]), url: linked[1] }
    : { type: "badge", kind, label: inner };
  return { node, next: BADGE_STICKY_RE.lastIndex };
}

/**
 * Scans `s` over [pos, end) looking for `closer` ("**", "*", or null for the
 * top-level call that has nothing to close). `insideEmphasis` turns off the
 * ` | ` separator rule -- false only for the outermost call, true for every
 * recursive one, however deeply nested.
 *
 * `found` tells the caller whether the scan stopped because `closer`
 * actually matched, or because it ran out of input first. A caller that
 * opened emphasis speculatively (on seeing "**" or "*") uses `found: false`
 * to know the marker never closes, discard the attempt, and re-scan that
 * same span itself with the marker as literal text -- which is what makes
 * `**abc` come out as the single text node "**abc" rather than a thrown
 * error or a dangling bold node.
 *
 * ponytail: closing the *current* run always wins over opening a new nested
 * one, which is what the required bold-containing-italic case needs (see
 * above). The untested reverse direction -- italic containing bold with the
 * delimiters directly adjacent, e.g. `*a **b** c*` -- loses under this rule
 * and comes out as three sibling italic nodes instead of one nesting a bold.
 * Neither the brief's test list nor the seed corpus exercises that shape.
 * Upgrade path if it's ever needed: a CommonMark-style delimiter stack that
 * resolves runs by looking at both directions before committing.
 */
function scan(
  s: string,
  pos: number,
  end: number,
  closer: "**" | "*" | null,
  insideEmphasis: boolean
): { nodes: InlineNode[]; pos: number; found: boolean } {
  const nodes: InlineNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      nodes.push({ type: "text", value: buf });
      buf = "";
    }
  };

  while (pos < end) {
    // Closing the current run always wins first -- this is what lets the
    // trailing "***" in "**a *b***" resolve as "*" (closes the italic) then
    // "**" (closes the bold) rather than the reverse.
    if (closer && s.startsWith(closer, pos)) {
      flush();
      return { nodes, pos: pos + closer.length, found: true };
    }

    if (!insideEmphasis && s.startsWith(" | ", pos)) {
      flush();
      nodes.push({ type: "sep" });
      pos += 3;
      continue;
    }

    if (s[pos] === "[") {
      const badge = matchBadge(s, pos);
      if (badge) {
        flush();
        nodes.push(badge.node);
        pos = badge.next;
        continue;
      }
      buf += "[";
      pos += 1;
      continue;
    }

    // "**" is checked before "*" so a genuine double-star opens bold, not
    // italic -- this is the "** binds before *" requirement.
    if (s.startsWith("**", pos)) {
      const attempt = scan(s, pos + 2, end, "**", true);
      if (attempt.found) {
        flush();
        nodes.push({ type: "bold", children: attempt.nodes });
        pos = attempt.pos;
        continue;
      }
      buf += "**";
      pos += 2;
      continue;
    }

    if (s[pos] === "*") {
      const attempt = scan(s, pos + 1, end, "*", true);
      if (attempt.found) {
        flush();
        nodes.push({ type: "italic", children: attempt.nodes });
        pos = attempt.pos;
        continue;
      }
      buf += "*";
      pos += 1;
      continue;
    }

    buf += s[pos];
    pos += 1;
  }

  flush();
  return { nodes, pos, found: false };
}

export function parseInline(src: string): InlineNode[] {
  if (!src) return [];
  return scan(src, 0, src.length, null, false).nodes;
}
