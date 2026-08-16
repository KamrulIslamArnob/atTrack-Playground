"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { type FC, memo, useState } from "react";
import { CheckIcon, CopyIcon, PanelRightOpen } from "lucide-react";

import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { useChatCanvas } from "@/components/ai-chatbot/chat-canvas-context";
import { cn } from "@/lib/utils";

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
      defer
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const canvasCtx = useChatCanvas();

  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  const onOpenCanvas = () => {
    if (!code || !canvasCtx?.openCanvas) return;
    const title = language ? `${language.toUpperCase()} Artifact` : "Code Artifact";
    canvasCtx.openCanvas(code, title, language);
  };

  return (
    <div className="aui-code-header-root border-border bg-muted/40 mt-3 flex items-center justify-between rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs">
      <span className="aui-code-header-language text-muted-foreground font-medium lowercase">
        {language}
      </span>
      <div className="flex items-center gap-1">
        {canvasCtx?.openCanvas && (
          <TooltipIconButton tooltip="Open in Canvas" onClick={onOpenCanvas}>
            <PanelRightOpen className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </TooltipIconButton>
        )}
        <TooltipIconButton tooltip="Copy" onClick={onCopy}>
          {!isCopied && (
            <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
          )}
          {isCopied && (
            <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
          )}
        </TooltipIconButton>
      </div>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    navigator.clipboard.writeText(value).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), copiedDuration);
      },
      () => {},
    );
  };

  return { isCopied, copyToClipboard };
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "aui-md-h1 mt-4 mb-2 text-base font-semibold text-foreground first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "aui-md-h2 mt-3.5 mb-1.5 text-sm font-semibold text-foreground first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "aui-md-h3 mt-3 mb-1 text-xs font-semibold text-foreground first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        "aui-md-h4 mt-2.5 mb-1 text-xs font-medium text-foreground first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn(
        "aui-md-h5 mt-2 mb-0.5 text-xs font-medium text-foreground first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn(
        "aui-md-h6 mt-2 mb-0.5 text-xs font-medium text-foreground first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "aui-md-p my-2 text-xs leading-relaxed text-foreground first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "aui-md-a text-primary hover:text-primary/80 underline underline-offset-2 text-xs",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "aui-md-blockquote border-border text-muted-foreground my-2.5 border-s-2 ps-3.5 text-xs leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "aui-md-ul marker:text-muted-foreground my-2 ms-5 list-disc text-xs text-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "aui-md-ol marker:text-muted-foreground my-2 ms-5 list-decimal text-xs text-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn("aui-md-hr border-border my-3", className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      <table
        className={cn(
          "aui-md-table w-full text-left text-xs border-collapse",
          className
        )}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "aui-md-th border-b border-border bg-muted/40 px-3.5 py-2 text-start text-[11px] font-semibold text-muted-foreground [[align=center]]:text-center [[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "aui-md-td px-3.5 py-2 text-start text-xs text-foreground [[align=center]]:text-center [[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr border-b border-border last:border-0 hover:bg-muted/40 transition-colors",
        className
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("aui-md-li text-xs leading-relaxed text-foreground", className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong
      className={cn("aui-md-strong font-semibold text-foreground text-xs", className)}
      {...props}
    />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={cn("aui-md-sup [&>a]:text-[11px] [&>a]:no-underline", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "aui-md-pre border-border bg-muted/30 overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 p-3.5 text-xs font-mono leading-relaxed text-foreground",
        className,
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-[11px]",
          className,
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});
