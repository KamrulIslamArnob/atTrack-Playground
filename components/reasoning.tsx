"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { BlocksIcon } from "@/components/ai-chatbot/blocks-icon";
import {
  useScrollLock,
  useAuiState,
  type ReasoningMessagePartComponent,
  type ReasoningGroupComponent,
} from "@assistant-ui/react";
import { MarkdownText } from "@/components/markdown-text";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const ANIMATION_DURATION = 200;

const ReasoningPreviewContext = createContext(false);

const reasoningVariants = cva("aui-reasoning-root w-full my-0.5", {
  variants: {
    variant: {
      ghost: "",
      outline: "rounded-xl border border-border px-3 py-2",
      muted: "rounded-xl bg-muted/40 px-3 py-2",
    },
  },
  defaultVariants: {
    variant: "ghost",
  },
});

export type ReasoningRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  "open" | "onOpenChange"
> &
  VariantProps<typeof reasoningVariants> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    streaming?: boolean;
  };

function ReasoningRoot({
  className,
  variant,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  streaming,
  children,
  ...props
}: ReasoningRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const [initialOpen] = useState(defaultOpen);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled
    ? controlledOpen
    : (userOpen ?? (streaming || initialOpen));
  const isPreview = streaming === true && isOpen;

  const prevStreamingRef = useRef(streaming);
  useLayoutEffect(() => {
    if (prevStreamingRef.current === streaming) return;
    prevStreamingRef.current = streaming;
    if (!isControlled && userOpen === null && !initialOpen) {
      lockScroll();
    }
  }, [streaming, isControlled, userOpen, lockScroll, initialOpen]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      lockScroll();
      if (!isControlled) {
        setUserOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  );

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="reasoning-root"
      data-variant={variant ?? "ghost"}
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(
        "group/reasoning-root",
        reasoningVariants({ variant: variant ?? "ghost", className }),
      )}
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      <ReasoningPreviewContext.Provider value={isPreview}>
        {children}
      </ReasoningPreviewContext.Provider>
    </Collapsible>
  );
}

function ReasoningFade({
  side = "bottom",
  className,
  ...props
}: React.ComponentProps<"div"> & { side?: "top" | "bottom" }) {
  return null;
}

function useReasoningTimer(active?: boolean, propDuration?: number) {
  const [elapsed, setElapsed] = useState<number>(propDuration ?? 0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (propDuration !== undefined) {
      setElapsed(propDuration);
      return;
    }

    if (active) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsed(seconds);
        }
      }, 500);
      return () => clearInterval(interval);
    } else {
      if (startTimeRef.current) {
        const finalSecs = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setElapsed(finalSecs);
      }
    }
  }, [active, propDuration]);

  return elapsed;
}

function ReasoningTrigger({
  active,
  duration,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  active?: boolean;
  duration?: number;
}) {
  const elapsed = useReasoningTimer(active, duration);
  const durationText = elapsed > 0 ? ` (${elapsed}s)` : "";

  return (
    <CollapsibleTrigger
      data-slot="reasoning-trigger"
      className={cn(
        "aui-reasoning-trigger group/trigger -mx-1.5 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer",
        className
      )}
      {...props}
    >
      <BlocksIcon size={14} className={cn("size-3.5 shrink-0 text-primary inline-flex", active && "animate-pulse")} />
      <span className={cn(active ? "text-foreground font-semibold" : "text-muted-foreground")}>
        {active ? "Thinking…" : `Thought${durationText}`}
      </span>
      <ChevronDown className="size-3.5 text-muted-foreground/70 transition-transform duration-200 -rotate-90 group-data-open/trigger:rotate-0 group-data-panel-open/trigger:rotate-0" />
    </CollapsibleTrigger>
  );
}

function ReasoningContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="reasoning-content"
      className={cn(
        "aui-reasoning-content overflow-hidden text-xs outline-none",
        "data-closed:animate-collapsible-up data-open:animate-collapsible-down",
        className
      )}
      {...props}
    >
      {children}
    </CollapsibleContent>
  );
}

function ReasoningText({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="reasoning-text"
      className={cn(
        "aui-reasoning-text relative z-0 mt-1 ml-2 pl-3.5 border-l border-border py-1 text-muted-foreground select-text",
        className
      )}
      {...props}
    >
      <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

const ReasoningImpl: ReasoningMessagePartComponent = () => <MarkdownText />;

const ReasoningGroupImpl: ReasoningGroupComponent = ({
  children,
  startIndex,
  endIndex,
}) => {
  const isReasoningStreaming = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    for (let index = startIndex; index <= endIndex; index++) {
      if (s.message.parts[index]?.status.type === "running") return true;
    }
    return false;
  });

  return (
    <ReasoningRoot streaming={isReasoningStreaming}>
      <ReasoningTrigger active={isReasoningStreaming} />
      <ReasoningContent aria-busy={isReasoningStreaming}>
        <ReasoningText>{children}</ReasoningText>
      </ReasoningContent>
    </ReasoningRoot>
  );
};

const Reasoning = memo(
  ReasoningImpl,
) as unknown as ReasoningMessagePartComponent & {
  Root: typeof ReasoningRoot;
  Trigger: typeof ReasoningTrigger;
  Content: typeof ReasoningContent;
  Text: typeof ReasoningText;
  Fade: typeof ReasoningFade;
};

Reasoning.displayName = "Reasoning";
Reasoning.Root = ReasoningRoot;
Reasoning.Trigger = ReasoningTrigger;
Reasoning.Content = ReasoningContent;
Reasoning.Text = ReasoningText;
Reasoning.Fade = ReasoningFade;

const ReasoningGroup = memo(ReasoningGroupImpl);
ReasoningGroup.displayName = "ReasoningGroup";

export {
  Reasoning,
  ReasoningGroup,
  ReasoningRoot,
  ReasoningTrigger,
  ReasoningContent,
  ReasoningText,
  ReasoningFade,
  reasoningVariants,
};
