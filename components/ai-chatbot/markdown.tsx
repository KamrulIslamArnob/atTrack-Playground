"use client";

import { Fragment, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  Copy,
  ExternalLink,
  Code2,
  Calendar,
  Briefcase,
  Database,
  Loader2,
  AlertCircle,
  ArrowUp,
  Table as TableIcon,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { executeLocalSqlQuery, type SqlQueryResult } from "@/lib/actions/database-query";

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
            className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-medium underline underline-offset-4 decoration-blue-500/30 hover:decoration-blue-500 transition-colors"
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

interface ParsedJobInfo {
  company: string;
  role: string;
  deadline?: string;
  fitPercentage?: number;
  note?: string;
}

/** Parse structured job application text from markdown bullet points */
function parseJobInfo(text: string): ParsedJobInfo | null {
  const clean = text.replace(/^[🗓️\s*-]+\s*/, "").trim();

  // Pattern: (85% fit) or 85% fit or (85%)
  const fitMatch = /(\d+)%\s*(?:fit)?/i.exec(clean);
  const fitPercentage = fitMatch ? parseInt(fitMatch[1], 10) : undefined;

  // Pattern: **Company** - Role, **deadline: Date** ...
  const companyRoleMatch = /^\*\*([^*]+)\*\*\s*[-–—:]\s*([^,–—]+)/.exec(clean);
  
  if (companyRoleMatch && (fitPercentage !== undefined || /deadline|mcq|result|interview/i.test(clean))) {
    const company = companyRoleMatch[1].trim();
    const role = companyRoleMatch[2].trim();

    // Extract deadline date e.g. "overall deadline: Aug 14" or "MCQ result: Aug 16" or "deadline: Aug 31"
    let deadline: string | undefined;
    const deadlineMatch = /(?:overall\s+deadline|application\s+deadline|deadline|mcq\s+result|interview\s+date|result):\s*\*\*?([A-Za-z0-9,\s]+?)\*\*?(?=\s*\(|\s*—|\s*–|\s*,|$)/i.exec(clean);
    if (deadlineMatch) {
      deadline = deadlineMatch[1].trim();
    } else {
      const altDeadlineMatch = /\*\*?(?:overall\s+deadline|deadline|mcq\s+result|result):\s*([^,*()]+)\*\*?/i.exec(clean);
      if (altDeadlineMatch) {
        deadline = altDeadlineMatch[1].replace(/\*\*/g, "").trim();
      }
    }

    // Extract notes after dash or parens (e.g. "— closest upcoming deadline")
    let note: string | undefined;
    const noteMatch = /[-–—]\s*([^–—]+)$/.exec(clean);
    if (noteMatch && !noteMatch[1].includes(role) && !noteMatch[1].includes(company)) {
      const candidate = noteMatch[1].trim();
      if (candidate && !candidate.toLowerCase().includes("fit") && !candidate.toLowerCase().includes("deadline")) {
        note = candidate;
      }
    }

    return { company, role, deadline, fitPercentage, note };
  }

  return null;
}

/** Render a single compact Job Application Card */
function JobApplicationCard({ job, index }: { job: ParsedJobInfo; index: number }) {
  const fit = job.fitPercentage;

  // Fit percentage status chip colors: Green (>80%), Yellow (60-79%), Gray/Orange (<60%)
  const fitBadge = fit !== undefined ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs border shrink-0",
        fit >= 80
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          : fit >= 60
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
          : "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20"
      )}
    >
      <span>{fit}% fit</span>
    </span>
  ) : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-sm">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Briefcase className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {job.company}
            </h4>
            <span className="text-xs text-muted-foreground font-normal truncate">
              {job.role}
            </span>
          </div>
          {job.note && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {job.note}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-10 sm:pl-0">
        {job.deadline && (
          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground font-medium">
            <Calendar className="size-3 text-blue-600 dark:text-blue-400" />
            <span className="truncate">{job.deadline}</span>
          </div>
        )}
        {fitBadge}
      </div>
    </div>
  );
}

interface MarkdownProps {
  content: string;
  onOpenCanvas?: (code: string, title?: string) => void;
  onApproveQuery?: (queryText: string, result?: SqlQueryResult) => void;
  onAskAiSummary?: (prompt: string) => void;
  className?: string;
}

export function Markdown({ content, onOpenCanvas, onApproveQuery, onAskAiSummary, className }: MarkdownProps) {
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

      // Check if items are tracked job applications
      const parsedJobs = items.map((it) => parseJobInfo(it));
      const hasJobCards = parsedJobs.some((j) => j !== null);

      if (hasJobCards) {
        blocks.push(
          <div key={`jobs-${blocks.length}`} className="my-3 space-y-2">
            {items.map((item, idx) => {
              const job = parsedJobs[idx];
              if (job) {
                return <JobApplicationCard key={idx} job={job} index={idx} />;
              }
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs leading-relaxed text-foreground flex items-center gap-2"
                >
                  <span className="size-1.5 rounded-full bg-blue-600 shrink-0" />
                  <div>{renderInline(item, `job-plain-${blocks.length}-${idx}`)}</div>
                </div>
              );
            })}
          </div>
        );
      } else {
        blocks.push(
          <ul key={`ul-${blocks.length}`} className="my-2 ml-4 list-disc space-y-1 marker:text-blue-600 dark:marker:text-blue-400 text-sm">
            {items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInline(item, `ul-${blocks.length}-${idx}`)}
              </li>
            ))}
          </ul>
        );
      }
    }

    if (orderedBuffer.length > 0) {
      const items = [...orderedBuffer];
      orderedBuffer = [];
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-2 ml-4 list-decimal space-y-1 marker:text-muted-foreground font-medium text-sm">
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
      const isSql = lang.toLowerCase() === "sql" || /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\s/i.test(codeText);

      if (isSql) {
        blocks.push(
          <DatabaseQueryBlock
            key={`dq-${blocks.length}`}
            code={codeText}
            onOpenCanvas={onOpenCanvas}
            onApproveQuery={onApproveQuery}
            onAskAiSummary={onAskAiSummary}
          />
        );
      } else {
        blocks.push(
          <CodeBlock
            key={`cb-${blocks.length}`}
            code={codeText}
            lang={lang}
            onOpenCanvas={onOpenCanvas}
          />
        );
      }
      continue;
    }

    // Markdown Table detection
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
        
        const hasSeparator = tableLines[1].includes("---");
        const bodyStart = hasSeparator ? 2 : 1;
        
        const bodyRows = tableLines.slice(bodyStart).map((row) =>
          row
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim())
        );

        blocks.push(
          <div key={`table-${blocks.length}`} className="my-3 overflow-x-auto rounded-xl border border-border/60 bg-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/50 font-semibold text-foreground">
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5 font-medium">
                      {renderInline(cell, `th-${blocks.length}-${cIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="transition-colors hover:bg-muted/30">
                    {row.map((cell, cIdx) => {
                      const fitMatch = /(\d+)%/i.exec(cell);
                      const isFitCell = fitMatch !== null && (headerRow[cIdx]?.toLowerCase().includes("fit") || cell.toLowerCase().includes("fit"));
                      
                      return (
                        <td key={cIdx} className="px-3.5 py-2.5 text-foreground">
                          {isFitCell ? (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                                parseInt(fitMatch[1], 10) >= 80
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : parseInt(fitMatch[1], 10) >= 60
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                  : "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20"
                              )}
                            >
                              {cell}
                            </span>
                          ) : (
                            renderInline(cell, `td-${blocks.length}-${rIdx}-${cIdx}`)
                          )}
                        </td>
                      );
                    })}
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
          className="my-2 border-l-2 border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-1.5 text-xs text-foreground/80 rounded-r-md italic"
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
      <p key={`p-${blocks.length}`} className="my-1.5 leading-relaxed text-sm text-foreground">
        {renderInline(paraLines.join(" "), `p-${blocks.length}`)}
      </p>
    );
  }
  flushLists();

  return <div className={cn("space-y-1 text-sm", className)}>{blocks}</div>;
}

interface CodeBlockProps {
  code: string;
  lang?: string;
  onOpenCanvas?: (code: string, title?: string) => void;
}

/** Lightweight Syntax Tokenizer for clean syntax highlighting */
function highlightSyntax(code: string, lang: string = ""): ReactNode[] {
  if (!code) return [];
  
  const keywords = new Set([
    "const", "let", "var", "function", "return", "import", "export", "from",
    "if", "else", "for", "while", "async", "await", "try", "catch", "class",
    "extends", "interface", "type", "public", "private", "protected", "def",
    "self", "select", "from", "where", "insert", "update", "delete", "true", "false", "null", "undefined"
  ]);

  const lines = code.split("\n");
  
  return lines.map((line, lineIdx) => {
    const tokens = line.split(/(\s+|[{}()[\];,.<>:=+\-*\/])/g);
    
    return (
      <div key={lineIdx} className="table-row">
        <span className="table-cell pr-3 select-none text-[10px] text-muted-foreground/40 text-right tabular-nums">
          {lineIdx + 1}
        </span>
        <span className="table-cell whitespace-pre">
          {tokens.map((token, tIdx) => {
            if (!token) return null;

            if (token.startsWith("//") || token.startsWith("#")) {
              return (
                <span key={tIdx} className="text-muted-foreground/60 italic">
                  {token}
                </span>
              );
            }

            if (keywords.has(token)) {
              return (
                <span key={tIdx} className="text-sky-400 font-semibold dark:text-sky-300">
                  {token}
                </span>
              );
            }

            if (/^["'`](.*)["'`]$/.test(token) || token.startsWith('"') || token.startsWith("'")) {
              return (
                <span key={tIdx} className="text-sky-300 dark:text-sky-200">
                  {token}
                </span>
              );
            }

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
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
            >
              Canvas
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
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

function DatabaseQueryBlock({
  code,
  onOpenCanvas,
  onApproveQuery,
  onAskAiSummary,
}: {
  code: string;
  onOpenCanvas?: (code: string, title?: string) => void;
  onApproveQuery?: (query: string, result?: SqlQueryResult) => void;
  onAskAiSummary?: (prompt: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [executionState, setExecutionState] = useState<"idle" | "running" | "success" | "error" | "declined">("idle");
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyJson() {
    if (!queryResult?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(queryResult.rows, null, 2));
    setCopiedJson(true);
    toast.success("Query results copied as JSON");
    setTimeout(() => setCopiedJson(false), 2000);
  }

  async function handleApproveAndExecute() {
    setExecutionState("running");
    try {
      const res = await executeLocalSqlQuery(code);
      setQueryResult(res);
      if (res.success) {
        setExecutionState("success");
        toast.success(`Query executed: ${res.rowCount ?? 0} row(s) returned`);
      } else {
        setExecutionState("error");
        toast.error(res.error || "Query failed");
      }
      if (onApproveQuery) {
        onApproveQuery(code, res);
      }
    } catch (err) {
      setExecutionState("error");
      const errRes: SqlQueryResult = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
      setQueryResult(errRes);
      toast.error("Execution failed");
      if (onApproveQuery) {
        onApproveQuery(code, errRes);
      }
    }
  }

  function handleDecline() {
    setExecutionState("declined");
    toast.info("Database query declined");
  }

  const rows = queryResult?.rows ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-blue-500/40 bg-slate-950 text-slate-100 shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-slate-900/90 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-blue-500/20 text-blue-400">
            <Database className="size-3.5" />
          </div>
          <span className="font-semibold text-xs text-slate-200">
            Local SQLite Database Query
          </span>
          {executionState === "idle" && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              🔒 Requires Approval
            </span>
          )}
          {executionState === "running" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-[10px] font-medium text-blue-300">
              <Loader2 className="size-3 animate-spin" />
              Executing in SQLite...
            </span>
          )}
          {/* Resolved states pop in — the approval is a decision, so its
              outcome should land rather than simply appear. */}
          {executionState === "success" && (
            <span className="agent-pop-in inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <Check className="size-3" />
              Executed · {queryResult?.rowCount ?? 0} {queryResult?.rowCount === 1 ? "row" : "rows"}
            </span>
          )}
          {executionState === "error" && (
            <span className="agent-pop-in inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-medium text-rose-400">
              <AlertCircle className="size-3" />
              Query Error
            </span>
          )}
          {executionState === "declined" && (
            <span className="agent-pop-in inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              ✕ Declined
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {executionState === "success" && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
            >
              <span>{isExpanded ? "Hide Details" : "View Query & Data"}</span>
              {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}

          {onOpenCanvas && (
            <button
              type="button"
              onClick={() => onOpenCanvas(code, "SQL Query")}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
            >
              Canvas
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
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

      {/* Success Compact Summary banner when not expanded */}
      {executionState === "success" && !isExpanded && (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/60 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-300">Database query executed in background. Generating response below...</span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <span>View Data Table</span>
            <ChevronDown className="size-3" />
          </button>
        </div>
      )}

      {/* SQL Code View (Visible when idle, running, or explicitly expanded) */}
      {(executionState !== "success" || isExpanded) && (
        <pre className="overflow-x-auto p-3.5 text-xs leading-relaxed font-mono bg-slate-950/80">
          <div className="table w-full">
            {highlightSyntax(code, "sql")}
          </div>
        </pre>
      )}

      {/* Query Result Section (Rendered when expanded) */}
      {executionState === "success" && isExpanded && (
        <div className="border-t border-slate-800/80 bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-800/70 bg-slate-900/80 px-3.5 py-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-300 text-[11px]">
              <TableIcon className="size-3.5 text-blue-400" />
              <span>Query Results ({queryResult?.rowCount ?? 0} {queryResult?.rowCount === 1 ? "record" : "records"})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                title="Copy result as JSON"
              >
                {copiedJson ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>{copiedJson ? "Copied JSON" : "Copy JSON"}</span>
              </button>
              {onOpenCanvas && (
                <button
                  type="button"
                  onClick={() => onOpenCanvas(JSON.stringify(rows, null, 2), "Query Results")}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Canvas
                </button>
              )}
            </div>
          </div>

          {rows.length > 0 ? (
            <div className="overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-300">
                    {columns.map((col) => (
                      <th key={col} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                      {columns.map((col) => {
                        const val = row[col];
                        const displayVal =
                          val === null
                            ? "null"
                            : typeof val === "object"
                            ? JSON.stringify(val)
                            : String(val);
                        return (
                          <td
                            key={col}
                            className={cn(
                              "px-3 py-1.5 whitespace-nowrap max-w-[240px] truncate text-slate-300",
                              val === null && "italic text-slate-500"
                            )}
                            title={displayVal}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">
              Query executed successfully. 0 rows returned.
            </div>
          )}

          {/* Quick AI Interpretation Action */}
          {onAskAiSummary && rows.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/50 px-3.5 py-2">
              <span className="text-[11px] text-slate-400">
                Need insights on these records?
              </span>
              <button
                type="button"
                onClick={() => {
                  onAskAiSummary(
                    `Please summarize and analyze these query results from my local database:\n\`\`\`json\n${JSON.stringify(rows.slice(0, 15), null, 2)}\n\`\`\``
                  );
                }}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition-colors cursor-pointer"
              >
                <Sparkles className="size-3 text-blue-400" />
                Ask AI to analyze results
              </button>
            </div>
          )}
        </div>
      )}

      {/* Query Error View */}
      {executionState === "error" && (
        <div className="border-t border-rose-900/40 bg-rose-950/20 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-1.5 font-semibold text-rose-400 mb-1">
            <AlertCircle className="size-3.5" />
            Execution Error
          </div>
          <p className="font-mono text-[11px] text-rose-300/90 whitespace-pre-wrap break-words">
            {queryResult?.error || "An error occurred while executing the query."}
          </p>
          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handleApproveAndExecute}
              className="flex items-center gap-1 rounded-md bg-rose-600/30 border border-rose-500/50 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-600/40 transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3" />
              Retry Query
            </button>
          </div>
        </div>
      )}

      {/* Interactive Approval Bar when Idle */}
      {executionState === "idle" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-900/70 px-3.5 py-2.5">
          <div className="text-[11px] text-slate-300 font-medium">
            Execute this read-only query against your local SQLite database?
          </div>

          {/* Decline stays quiet; approve carries the weight and the arrow,
              so the destructive-by-default reading is "nothing happens". */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDecline}
              className="micro-press rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={handleApproveAndExecute}
              className="micro-press group/approve flex items-center gap-1.5 rounded-lg bg-blue-600 py-1 pl-3 pr-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-500 cursor-pointer"
            >
              Approve &amp; Execute
              <span className="flex size-5 items-center justify-center rounded-md bg-white/15 transition-transform duration-200 group-hover/approve:-translate-y-0.5">
                <ArrowUp className="size-3" />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
