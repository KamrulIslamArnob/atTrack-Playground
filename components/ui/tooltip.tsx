"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import {
  Info,
  Heart,
  Wrench,
  Briefcase,
  Clock,
  MessageSquare,
  Trophy,
  ThumbsDown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function TooltipProvider({ children, delay = 80, ...props }: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 max-w-md rounded-xl border border-border/80 bg-card/95 p-2.5 text-xs text-card-foreground shadow-xl backdrop-blur-md outline-none origin-(--transform-origin) transition-all duration-150 ease-out data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 select-none",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="fill-card stroke-border/80 size-2.5 -mt-px" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Accessible Info Tooltip trigger button using emi-emi-animation-vocabulary Pop In & Scale In motion.
 */
export function InfoTooltip({
  content,
  side = "top",
  className,
  iconClassName = "size-3.5",
}: {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  iconClassName?: string;
}) {
  return (
    <TooltipProvider delay={60}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-all duration-150 active:scale-90 hover:scale-110 hover:rotate-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-help p-0.5 select-none",
            className
          )}
          aria-label="Information"
        >
          <Info className={cn("shrink-0", iconClassName)} />
        </TooltipTrigger>
        <TooltipContent side={side} className="leading-tight">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 3x3 Grid Layout colorful stage guide for the main Board page title header.
 */
export function StageTooltipContent() {
  const stages: Array<{
    name: string;
    desc: string;
    color: string;
    icon: LucideIcon;
  }> = [
    {
      name: "Wishlist",
      desc: "Where saved jobs land initially when first added.",
      color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      icon: Heart,
    },
    {
      name: "Preparing",
      desc: "Jobs to apply for while preparing assignments.",
      color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      icon: Wrench,
    },
    {
      name: "Applied",
      desc: "Applications officially submitted.",
      color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
      icon: Briefcase,
    },
    {
      name: "MCQ / Screening",
      desc: "Jobs with exam dates or screening interviews.",
      color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
      icon: Clock,
    },
    {
      name: "Interview",
      desc: "Active stage when you get an interview call.",
      color: "bg-lime-500/20 text-lime-800 dark:text-lime-300 border-lime-500/40",
      icon: MessageSquare,
    },
    {
      name: "Offer",
      desc: "Stage when you receive a job offer letter.",
      color: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
      icon: Trophy,
    },
    {
      name: "Rejected",
      desc: "Records for declined or unsuccessful apps.",
      color: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      icon: ThumbsDown,
    },
  ];

  return (
    <div className="space-y-2 p-0.5 max-w-md min-w-[340px]">
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5 mb-1.5">
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Sparkles className="size-3 text-amber-500 animate-pulse" />
          Kanban Pipeline Stages
        </span>
        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
          Workflow Guide
        </span>
      </div>

      {/* 3x3 Grid Layout */}
      <div className="grid grid-cols-3 gap-2">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.name}
              className="flex flex-col items-start gap-1 p-2 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/50 transition-all duration-150 group/stage"
            >
              <div className="flex items-center gap-1.5 w-full">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold shadow-2xs transition-transform duration-150 group-hover/stage:scale-110",
                    stage.color
                  )}
                >
                  <Icon className="size-3" />
                </span>
                <p className="text-[11px] font-bold text-foreground tracking-tight leading-none truncate">
                  {stage.name}
                </p>
              </div>
              <p className="text-[10px] leading-tight text-muted-foreground font-normal">
                {stage.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Rich colorful single stage item for individual column header tooltips.
 */
export function SingleStageTooltipContent({
  kind,
  name,
}: {
  kind: string;
  name: string;
}) {
  const STAGE_CONFIGS: Record<
    string,
    { desc: string; color: string; icon: LucideIcon }
  > = {
    wishlist: {
      desc: "Where saved jobs land initially when first added.",
      color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      icon: Heart,
    },
    preparing: {
      desc: "Jobs you plan to apply for while preparing assignments or custom resumes.",
      color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      icon: Wrench,
    },
    applied: {
      desc: "Applications you have officially submitted.",
      color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
      icon: Briefcase,
    },
    mcq: {
      desc: "Jobs with an exam date, MCQ assessment, or screening interview date.",
      color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
      icon: Clock,
    },
    screening: {
      desc: "Jobs with an exam date, MCQ assessment, or screening interview date.",
      color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
      icon: Clock,
    },
    interview: {
      desc: "Active stage when you receive an official interview call.",
      color: "bg-lime-500/20 text-lime-800 dark:text-lime-300 border-lime-500/40",
      icon: MessageSquare,
    },
    offer: {
      desc: "Stage when you receive an official job offer letter.",
      color: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
      icon: Trophy,
    },
    accepted: {
      desc: "Offers you have accepted.",
      color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      icon: Trophy,
    },
    rejected: {
      desc: "Records for non-selected applications or declined offers.",
      color: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      icon: ThumbsDown,
    },
  };

  const info = STAGE_CONFIGS[kind.toLowerCase()] ?? {
    desc: `${name}: Custom stage in your job tracking workflow.`,
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Briefcase,
  };
  const Icon = info.icon;

  return (
    <div className="flex items-start gap-2 p-0.5 max-w-[220px]">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold shadow-2xs mt-0.5",
          info.color
        )}
      >
        <Icon className="size-3" />
      </span>
      <div className="space-y-0 min-w-0">
        <p className="text-[11px] font-bold text-foreground tracking-tight leading-tight">{name}</p>
        <p className="text-[10.5px] leading-tight text-muted-foreground font-normal">{info.desc}</p>
      </div>
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
