"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  X, Code2, WrapText } from "lucide-react";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { DownloadIcon } from "@/components/ui/download";
import { toast } from "sonner";

export interface ChatCanvasProps {
  content: string | null;
  title?: string;
  onClose: () => void;
  isOpen: boolean;
  className?: string;
}

export function ChatCanvas({
  content,
  title = "Artifact",
  onClose,
  isOpen,
  className,
}: ChatCanvasProps) {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);

  const lines = useMemo(() => {
    if (!content) return [];
    return content.split("\n");
  }, [content]);

  const stats = useMemo(() => {
    if (!content) return { lines: 0, words: 0 };
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return { lines: lines.length, words };
  }, [content, lines]);

  function handleCopy() {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/gi, "-") || "artifact"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }

  return (
    <AnimatePresence>
      {isOpen && content !== null && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-card md:w-[45%]",
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Code2 className="size-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.lines} lines · {stats.words} words
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setWrapLines((prev) => !prev)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer",
                    wrapLines && "bg-muted text-foreground"
                  )}
                  title={wrapLines ? "Unwrap lines" : "Wrap lines"}
                >
                  <WrapText className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
                  title="Copy"
                >
                  {copied ? <CheckIcon className="size-3.5 text-primary" /> : <CopyIcon className="size-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
                  title="Download"
                >
                  <DownloadIcon className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95 cursor-pointer"
                  title="Close"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="rounded-xl border border-border bg-muted/20 font-mono text-xs leading-relaxed">
                  <table className="w-full border-collapse">
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={idx} className="group hover:bg-muted/40 transition-colors">
                          <td className="w-10 select-none border-r border-border/40 py-1.5 pr-3 text-right font-mono text-[10px] text-muted-foreground/50">
                            {idx + 1}
                          </td>
                          <td
                            className={cn(
                              "py-1.5 pl-3 text-foreground",
                              wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre"
                            )}
                          >
                            {line || " "}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
