"use client";

import { Fragment, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy, ExternalLink, Code2 } from "lucide-react";

/** Inline formatting: **bold**, *italic*, `code`, [text](url). */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("_")) {
      nodes.push(<em key={`${keyPrefix}-i${i++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i++}`}
          className="rounded-md border border-border/40 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (m) {
        nodes.push(
          <a
            key={`${keyPrefix}-a${i++}`}
            href={m[2]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-primary font-medium underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors"
          >
            {m[1]}
            <ExternalLink className="size-3 opacity-70" />
          </a>
        );
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(lastIndex)}</Fragment>);
  }
  return nodes;
}

interface MarkdownProps {
  content: string;
  onOpenCanvas?: (code: string, title?: string) => void;
  className?: string;
}

export function Markdown({ content, onOpenCanvas, className }: MarkdownProps) {
  // Strip residual reasoning tags if present
  const cleaned = content
    .replace(/^[\s\S]*?<\/think>/i, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "");

  const lines = cleaned.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  let unorderedBuffer: string[] = [];
  let orderedBuffer: string[] = [];

  const flushLists = () => {
    if (unorderedBuffer.length > 0) {
      const items = [...unorderedBuffer];
      unorderedBuffer = [];
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-2 ml-4 list-disc space-y-1 marker:text-primary">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item, `ul-${blocks.length}-${idx}`)}
            </li>
          ))}
        </ul>
      );
    }
    if (orderedBuffer.length > 0) {
      const items = [...orderedBuffer];
      orderedBuffer = [];
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-2 ml-4 list-decimal space-y-1 marker:text-muted-foreground/80 font-medium">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed font-normal">
              {renderInline(item, `ol-${blocks.length}-${idx}`)}
            </li>
          ))}
        </ol>
      );
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flushLists();
      const lang = fence[1] || "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const codeText = body.join("\n");
      blocks.push(
        <CodeBlock key={`cb-${blocks.length}`} code={codeText} lang={lang} onOpenCanvas={onOpenCanvas} />
      );
      continue;
    }

    // Markdown Table detection: Line starts and ends with | or contains |
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushLists();
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        
        // Skip separator line if present (e.g. |---|---|)
        const hasSeparator = tableLines[1].includes("---");
        const bodyStart = hasSeparator ? 2 : 1;
        
        const bodyRows = tableLines.slice(bodyStart).map((row) =>
          row
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim())
        );

        blocks.push(
          <div key={`table-${blocks.length}`} className="my-3 overflow-x-auto rounded-xl border border-border/50 bg-card/60 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/40 font-semibold text-foreground">
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5 font-medium">
                      {renderInline(cell, `th-${blocks.length}-${cIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="transition-colors hover:bg-muted/30">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-muted-foreground">
                        {renderInline(cell, `td-${blocks.length}-${rIdx}-${cIdx}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Heading
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushLists();
      const level = heading[1].length;
      const text = heading[2];
      const Tag = (level === 1 ? "h3" : level === 2 ? "h4" : "h5") as React.ElementType;
      blocks.push(
        <Tag
          key={`h-${blocks.length}`}
          className={cn(
            "mt-3 mb-1 font-semibold tracking-tight text-foreground",
            level === 1 && "text-base font-bold text-foreground",
            level === 2 && "text-sm font-semibold text-foreground/90",
            level === 3 && "text-xs font-semibold text-muted-foreground"
          )}
        >
          {renderInline(text, `h-${blocks.length}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // Blockquote
    const quote = /^\s*>\s*(.*)$/.exec(line);
    if (quote) {
      flushLists();
      blocks.push(
        <blockquote
          key={`bq-${blocks.length}`}
          className="my-2 border-l-2 border-primary/80 bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground rounded-r-md italic"
        >
          {renderInline(quote[1], `bq-${blocks.length}`)}
        </blockquote>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushLists();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-border/40" />);
      i++;
      continue;
    }

    // Unordered List item
    const uli = /^\s*[-*]\s+(.*)$/.exec(line);
    if (uli) {
      unorderedBuffer.push(uli[1]);
      i++;
      continue;
    }

    // Ordered List item
    const oli = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (oli) {
      orderedBuffer.push(oli[1]);
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      flushLists();
      i++;
      continue;
    }

    // Paragraph
    flushLists();
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^\s*[-*]\s/.test(lines[i]) &&
      !/^\s*\d+\.\s/.test(lines[i]) &&
      !/^\s*>\s/.test(lines[i]) &&
      !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|"))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-1.5 leading-relaxed text-[14.5px]">
        {renderInline(paraLines.join(" "), `p-${blocks.length}`)}
      </p>
    );
  }
  flushLists();

  return <div className={cn("space-y-0.5 text-sm", className)}>{blocks}</div>;
}

interface CodeBlockProps {
  code: string;
  lang?: string;
  onOpenCanvas?: (code: string, title?: string) => void;
}

/** Lightweight Syntax Tokenizer for clean syntax highlighting */
function highlightSyntax(code: string, lang: string = ""): ReactNode[] {
  const normalizedLang = lang.toLowerCase();
  
  if (!code) return [];
  
  const keywords = new Set([
    "const", "let", "var", "function", "return", "import", "export", "from",
    "if", "else", "for", "while", "async", "await", "try", "catch", "class",
    "extends", "interface", "type", "public", "private", "protected", "def",
    "self", "select", "from", "where", "insert", "update", "delete", "true", "false", "null", "undefined"
  ]);

  const lines = code.split("\n");
  
  return lines.map((line, lineIdx) => {
    // Basic tokenizer by spaces & punctuation
    const tokens = line.split(/(\s+|[{}()[\];,.<>:=+\-*\/])/g);
    
    return (
      <div key={lineIdx} className="table-row">
        <span className="table-cell pr-3 select-none text-[10px] text-muted-foreground/40 text-right tabular-nums">
          {lineIdx + 1}
        </span>
        <span className="table-cell whitespace-pre">
          {tokens.map((token, tIdx) => {
            if (!token) return null;

            // Comment
            if (token.startsWith("//") || token.startsWith("#")) {
              return (
                <span key={tIdx} className="text-muted-foreground/60 italic">
                  {token}
                </span>
              );
            }

            // Keyword
            if (keywords.has(token)) {
              return (
                <span key={tIdx} className="text-sky-400 font-semibold dark:text-sky-300">
                  {token}
                </span>
              );
            }

            // String
            if (/^["'`](.*)["'`]$/.test(token) || token.startsWith('"') || token.startsWith("'")) {
              return (
                <span key={tIdx} className="text-sky-300 dark:text-sky-200">
                  {token}
                </span>
              );
            }

            // Number
            if (/^\d+$/.test(token)) {
              return (
                <span key={tIdx} className="text-amber-400 dark:text-amber-300 font-mono">
                  {token}
                </span>
              );
            }

            return <span key={tIdx}>{token}</span>;
          })}
        </span>
      </div>
    );
  });
}

function CodeBlock({ code, lang, onOpenCanvas }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-border/50 bg-slate-950 text-slate-100 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-3.5 py-1.5">
        <div className="flex items-center gap-2">
          <Code2 className="size-3.5 text-sky-400" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {lang || "code"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenCanvas && (
            <button
              type="button"
              onClick={() => onOpenCanvas(code, lang ? `${lang.toUpperCase()} Snippet` : "Code Snippet")}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95"
            >
              Canvas
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95"
          >
            {copied ? (
              <>
                <Check className="size-3 text-sky-400" />
                <span className="text-sky-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <pre className="overflow-x-auto p-3 text-xs leading-relaxed font-mono">
        <div className="table w-full">
          {highlightSyntax(code, lang)}
        </div>
      </pre>
    </div>
  );
}
