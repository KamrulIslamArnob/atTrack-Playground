"use client";

import { useState } from "react";
import {
  Briefcase,
  Building2,
  House,
  Blend,
  CircleHelp,
  Clock3,
  CalendarClock,
  Handshake,
  GraduationCap,
  HeartHandshake,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { FileTextIcon } from "@/components/ui/file-text";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
} from "recharts";

const tooltipStyle = {
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "var(--elevation-3)",
  fontSize: "12px",
};

/** Recharts axis/grid ink — read as CSS var strings since recharts props take color values */
const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const gridStroke = "var(--border)";

interface TrendData {
  date: string;
  applications: number;
  interviews: number;
}

interface McqScoreData {
  date: string;
  score: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  count: number;
  /** Read from board_lists.color so a renamed/recoloured list stays in sync. */
  color: string;
}

interface StageTheme {
  gradFrom: string;
  gradTo: string;
  countText: string;
  pillBg: string;
  pillText: string;
  type:
    | "wishlist"
    | "preparing"
    | "applied"
    | "screening"
    | "interview"
    | "assessment"
    | "offer"
    | "hired"
    | "target"
    | "unsorted"
    | "rejected"
    | "custom-0"
    | "custom-1"
    | "custom-2"
    | "custom-3"
    | "custom-4"
    | "custom-5";
}

function getStageTheme(name: string, index: number): StageTheme {
  const lower = name.toLowerCase();

  if (lower.includes("wish") || lower.includes("saved") || lower.includes("bookm")) {
    return {
      gradFrom: "#818cf8",
      gradTo: "#c084fc",
      countText: "text-indigo-600 dark:text-indigo-400",
      pillBg: "bg-indigo-50 dark:bg-indigo-950/60",
      pillText: "text-indigo-600 dark:text-indigo-300",
      type: "wishlist",
    };
  }

  if (lower.includes("prep") || lower.includes("draft") || lower.includes("write") || lower.includes("craft")) {
    return {
      gradFrom: "#fbbf24",
      gradTo: "#f97316",
      countText: "text-amber-600 dark:text-amber-400",
      pillBg: "bg-amber-50 dark:bg-amber-950/60",
      pillText: "text-amber-700 dark:text-amber-300",
      type: "preparing",
    };
  }

  if (lower.includes("apply") || lower.includes("applied") || lower.includes("sent") || lower.includes("submit")) {
    return {
      gradFrom: "#3b82f6",
      gradTo: "#6366f1",
      countText: "text-blue-600 dark:text-blue-400",
      pillBg: "bg-blue-50 dark:bg-blue-950/60",
      pillText: "text-blue-600 dark:text-blue-300",
      type: "applied",
    };
  }

  if (lower.includes("screen") || lower.includes("phone") || lower.includes("review")) {
    return {
      gradFrom: "#facc15",
      gradTo: "#f59e0b",
      countText: "text-yellow-700 dark:text-yellow-400",
      pillBg: "bg-yellow-50 dark:bg-yellow-950/60",
      pillText: "text-yellow-700 dark:text-yellow-300",
      type: "screening",
    };
  }

  if (lower.includes("interview") || lower.includes("meet") || lower.includes("call") || lower.includes("rounds")) {
    return {
      gradFrom: "#38bdf8",
      gradTo: "#3b82f6",
      countText: "text-sky-600 dark:text-sky-400",
      pillBg: "bg-sky-50 dark:bg-sky-950/60",
      pillText: "text-sky-600 dark:text-sky-300",
      type: "interview",
    };
  }

  if (lower.includes("assess") || lower.includes("test") || lower.includes("mcq") || lower.includes("task") || lower.includes("code") || lower.includes("challenge")) {
    return {
      gradFrom: "#34d399",
      gradTo: "#10b981",
      countText: "text-emerald-600 dark:text-emerald-400",
      pillBg: "bg-emerald-50 dark:bg-emerald-950/60",
      pillText: "text-emerald-700 dark:text-emerald-300",
      type: "assessment",
    };
  }

  if (lower.includes("offer") || lower.includes("decision") || lower.includes("negotiat")) {
    return {
      gradFrom: "#a855f7",
      gradTo: "#8b5cf6",
      countText: "text-purple-600 dark:text-purple-400",
      pillBg: "bg-purple-50 dark:bg-purple-950/60",
      pillText: "text-purple-600 dark:text-purple-300",
      type: "offer",
    };
  }

  if (lower.includes("hire") || lower.includes("accept") || lower.includes("won") || lower.includes("success")) {
    return {
      gradFrom: "#fb7185",
      gradTo: "#ec4899",
      countText: "text-rose-600 dark:text-rose-400",
      pillBg: "bg-rose-50 dark:bg-rose-950/60",
      pillText: "text-rose-600 dark:text-rose-300",
      type: "hired",
    };
  }

  if (lower.includes("target") || lower.includes("goal") || lower.includes("focus")) {
    return {
      gradFrom: "#2dd4bf",
      gradTo: "#0d9488",
      countText: "text-teal-600 dark:text-teal-400",
      pillBg: "bg-teal-50 dark:bg-teal-950/60",
      pillText: "text-teal-700 dark:text-teal-300",
      type: "target",
    };
  }

  if (lower.includes("unsort") || lower.includes("inbox") || lower.includes("new") || lower.includes("raw")) {
    return {
      gradFrom: "#22d3ee",
      gradTo: "#0284c7",
      countText: "text-cyan-600 dark:text-cyan-400",
      pillBg: "bg-cyan-50 dark:bg-cyan-950/60",
      pillText: "text-cyan-700 dark:text-cyan-300",
      type: "unsorted",
    };
  }

  if (lower.includes("reject") || lower.includes("archive") || lower.includes("pass") || lower.includes("close")) {
    return {
      gradFrom: "#f87171",
      gradTo: "#ef4444",
      countText: "text-red-600 dark:text-red-400",
      pillBg: "bg-red-50 dark:bg-red-950/60",
      pillText: "text-red-600 dark:text-red-300",
      type: "rejected",
    };
  }

  // Fallback unique indexed cycling palette
  const fallbacks: StageTheme[] = [
    {
      gradFrom: "#a78bfa",
      gradTo: "#818cf8",
      countText: "text-violet-600 dark:text-violet-400",
      pillBg: "bg-violet-50 dark:bg-violet-950/60",
      pillText: "text-violet-600 dark:text-violet-300",
      type: "custom-0",
    },
    {
      gradFrom: "#fb923c",
      gradTo: "#f59e0b",
      countText: "text-orange-600 dark:text-orange-400",
      pillBg: "bg-orange-50 dark:bg-orange-950/60",
      pillText: "text-orange-700 dark:text-orange-300",
      type: "custom-1",
    },
    {
      gradFrom: "#a3e635",
      gradTo: "#4ade80",
      countText: "text-lime-700 dark:text-lime-400",
      pillBg: "bg-lime-50 dark:bg-lime-950/60",
      pillText: "text-lime-700 dark:text-lime-300",
      type: "custom-2",
    },
    {
      gradFrom: "#e879f9",
      gradTo: "#f472b6",
      countText: "text-fuchsia-600 dark:text-fuchsia-400",
      pillBg: "bg-fuchsia-50 dark:bg-fuchsia-950/60",
      pillText: "text-fuchsia-600 dark:text-fuchsia-300",
      type: "custom-3",
    },
    {
      gradFrom: "#94a3b8",
      gradTo: "#64748b",
      countText: "text-slate-600 dark:text-slate-400",
      pillBg: "bg-slate-50 dark:bg-slate-800/60",
      pillText: "text-slate-600 dark:text-slate-300",
      type: "custom-4",
    },
    {
      gradFrom: "#f472b6",
      gradTo: "#fb7185",
      countText: "text-pink-600 dark:text-pink-400",
      pillBg: "bg-pink-50 dark:bg-pink-950/60",
      pillText: "text-pink-600 dark:text-pink-300",
      type: "custom-5",
    },
  ];

  return fallbacks[index % fallbacks.length];
}

/** 1. Illustrated Wishlist / Bookmark Magic Wand Stage */
function WishlistIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Magic Wand / Sparkle Bookmark */}
      <path d="M22 58 L52 28" stroke="#4f46e5" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M48 24 L56 32" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
      {/* Wand Star Tip */}
      <path
        d="M56 16 L59 23 L67 24 L61 30 L63 38 L56 34 L49 38 L51 30 L45 24 L53 23 Z"
        fill="#fbbf24"
        stroke="#d97706"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Star center glint */}
      <circle cx="56" cy="27" r="2" fill="#ffffff" />
      {/* Surrounding sparkles */}
      <path d="M26 22 L26 28 M23 25 L29 25" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 14 L38 18 M36 16 L40 16" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28" cy="44" r="1.5" fill="#a5b4fc" />
      <circle cx="48" cy="48" r="2" fill="#6366f1" />
    </svg>
  );
}

/** 2. Illustrated Preparing / Drafting Clipboard Stage */
function PreparingIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Clipboard Backboard */}
      <rect x="22" y="18" width="36" height="48" rx="4" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
      {/* Clip top */}
      <rect x="32" y="14" width="16" height="8" rx="2" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
      {/* Paper Sheet */}
      <rect x="26" y="22" width="28" height="40" rx="2" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
      {/* Document drafting lines */}
      <line x1="30" y1="28" x2="44" y2="28" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="30" y1="34" x2="50" y2="34" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="40" x2="46" y2="40" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="46" x2="40" y2="46" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      {/* Drafting Pencil */}
      <g transform="rotate(-35 52 46)">
        <polygon points="50,46 54,46 52,54" fill="#f87171" />
        <rect x="50" y="24" width="4" height="22" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
        <rect x="50" y="20" width="4" height="4" fill="#cbd5e1" />
      </g>
    </svg>
  );
}

/** 3. Illustrated Mailbox for Applied Stage */
function MailboxIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Wooden Post */}
      <rect x="35" y="44" width="10" height="28" rx="2" fill="#78350f" stroke="#451a03" strokeWidth="1.5" />
      <rect x="35" y="46" width="3" height="24" fill="#92400e" opacity="0.6" />
      {/* Mailbox Body (Blue Curved) */}
      <path
        d="M20 44 L20 28 Q20 18 36 18 Q52 18 52 28 L52 44 Z"
        fill="#2563eb"
        stroke="#1e3a8a"
        strokeWidth="2"
      />
      {/* Mailbox Door / Opening */}
      <path
        d="M24 44 L24 29 Q24 22 36 22 Q48 22 48 29 L48 44 Z"
        fill="#1d4ed8"
        stroke="#1e3a8a"
        strokeWidth="1.5"
      />
      {/* Interior Depth */}
      <ellipse cx="36" cy="38" rx="10" ry="5" fill="#0f172a" opacity="0.75" />
      {/* Red Signal Flag */}
      <path d="M52 30 L64 30 L64 20 L58 20 L58 30" fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="52" cy="30" r="2.5" fill="#991b1b" />
      {/* Soft Highlight */}
      <path d="M25 28 Q25 22 36 22" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/** 4. Illustrated Magnifier for Screening Stage */
function ScreeningIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Wooden Handle with grip */}
      <path d="M48 48 L66 66" stroke="#78350f" strokeWidth="7" strokeLinecap="round" />
      <path d="M48 48 L66 66" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
      {/* Metal Joint Collar */}
      <circle cx="47" cy="47" r="4" fill="#64748b" stroke="#334155" strokeWidth="1.5" />
      {/* Outer Ring */}
      <circle cx="34" cy="34" r="18" fill="#f8fafc" stroke="#334155" strokeWidth="3" />
      {/* Glass Lens (Ice Blue Reflection) */}
      <circle cx="34" cy="34" r="15" fill="#fef08a" opacity="0.6" />
      {/* Lens Reflection Arc */}
      <path
        d="M24 26 Q30 20 38 22"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="23" cy="32" r="1.5" fill="#ffffff" />
    </svg>
  );
}

/** 5. Illustrated Chat Bubbles for Interview Stage */
function InterviewIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Primary Blue Bubble */}
      <path
        d="M18 20 C18 14 26 12 38 12 C50 12 58 16 58 26 C58 36 48 40 38 40 C34 40 30 42 22 46 C24 41 24 38 22 36 C19 32 18 26 18 20 Z"
        fill="#38bdf8"
        stroke="#0284c7"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Blue Bubble 3 Dots */}
      <circle cx="30" cy="26" r="2" fill="#ffffff" />
      <circle cx="38" cy="26" r="2" fill="#ffffff" />
      <circle cx="46" cy="26" r="2" fill="#ffffff" />

      {/* Secondary White/Light Bubble */}
      <path
        d="M40 38 C40 32 46 30 54 30 C62 30 68 34 68 42 C68 48 62 52 54 52 C51 52 48 54 42 58 C44 54 44 51 42 49 C40 46 40 42 40 38 Z"
        fill="#ffffff"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Light Bubble Dots */}
      <circle cx="48" cy="42" r="1.5" fill="#94a3b8" />
      <circle cx="54" cy="42" r="1.5" fill="#94a3b8" />
      <circle cx="60" cy="42" r="1.5" fill="#94a3b8" />
    </svg>
  );
}

/** 6. Illustrated Checklist Paper for Assessment Stage */
function AssessmentIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Sheet of Paper with folded corner */}
      <path
        d="M24 16 L48 16 L58 26 L58 64 L24 64 Z"
        fill="#ffffff"
        stroke="#334155"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Folded Corner flap */}
      <path d="M48 16 L48 26 L58 26 Z" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
      {/* Checklist items */}
      {/* Item 1 Checkmark */}
      <path d="M30 32 L33 35 L40 28" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="43" y1="32" x2="52" y2="32" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      {/* Item 2 Checkmark */}
      <path d="M30 42 L33 45 L40 38" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="43" y1="42" x2="52" y2="42" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      {/* Item 3 Checkmark */}
      <path d="M30 52 L33 55 L40 48" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="43" y1="52" x2="52" y2="52" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 7. Illustrated Love Letter / Heart Envelope for Offer Stage */
function OfferIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Envelope Back */}
      <rect x="20" y="28" width="40" height="30" rx="3" fill="#c084fc" stroke="#6b21a8" strokeWidth="2" />
      {/* Floating Heart emerging from envelope */}
      <path
        d="M40 25 C37 18 28 20 28 27 C28 35 40 42 40 42 C40 42 52 35 52 27 C52 20 43 18 40 25 Z"
        fill="#7c3aed"
        stroke="#4c1d95"
        strokeWidth="1.5"
      />
      {/* Heart Glint */}
      <path d="M32 24 Q35 22 37 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      {/* Envelope Front Flaps */}
      <path d="M20 28 L40 44 L60 28" fill="none" stroke="#6b21a8" strokeWidth="2" />
      <path d="M20 58 L35 40" fill="none" stroke="#6b21a8" strokeWidth="1.5" opacity="0.6" />
      <path d="M60 58 L45 40" fill="none" stroke="#6b21a8" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

/** 8. Illustrated Party Popper for Hired Stage */
function HiredIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Party Popper Cone */}
      <path
        d="M26 62 L48 42 L34 28 Z"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Striped Party Cone Details */}
      <path d="M31 57 L44 45" stroke="#ef4444" strokeWidth="3" />
      <path d="M37 51 L46 43" stroke="#3b82f6" strokeWidth="2.5" />
      <path d="M28 60 L33 55" stroke="#10b981" strokeWidth="2" />

      {/* Bursting Confetti Strips */}
      <path d="M42 24 Q48 16 54 22" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 32 Q58 26 64 34" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 18 Q44 10 52 14" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />

      {/* Confetti Dots & Stars */}
      <circle cx="56" cy="18" r="2" fill="#ec4899" />
      <circle cx="62" cy="26" r="1.5" fill="#f59e0b" />
      <circle cx="48" cy="14" r="1.5" fill="#8b5cf6" />
      <circle cx="66" cy="38" r="2" fill="#10b981" />
      <circle cx="58" cy="44" r="1.5" fill="#ef4444" />
    </svg>
  );
}

/** 9. Illustrated Target / Bullseye Stage */
function TargetIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Target Board Stand */}
      <path d="M28 66 L40 50 L52 66" stroke="#475569" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Outer Ring */}
      <circle cx="40" cy="36" r="20" fill="#0d9488" stroke="#115e59" strokeWidth="2" />
      {/* Middle Ring */}
      <circle cx="40" cy="36" r="14" fill="#ffffff" />
      {/* Inner Red Bullseye */}
      <circle cx="40" cy="36" r="8" fill="#ef4444" />
      <circle cx="40" cy="36" r="3" fill="#ffffff" />
      {/* Arrow striking center */}
      <path d="M56 20 L40 36" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
      {/* Arrow fletching */}
      <path d="M54 18 L60 20 L58 26" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
    </svg>
  );
}

/** 10. Illustrated Unsorted / Inbox Tray Stage */
function UnsortedIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Inbox Paper Tray */}
      <path
        d="M20 38 L26 58 L54 58 L60 38 L48 38 L44 44 L36 44 L32 38 Z"
        fill="#06b6d4"
        stroke="#0e7490"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Documents resting inside */}
      <rect x="28" y="30" width="24" height="18" rx="1.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
      <line x1="32" y1="35" x2="44" y2="35" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="39" x2="48" y2="39" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      {/* Incoming Download Arrow */}
      <path d="M40 14 L40 28 M34 22 L40 28 L46 22" fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 11. Illustrated Rejected / Archive Folder Stage */
function RejectedIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      {/* Archive Folder back */}
      <path d="M22 24 L34 24 L38 28 L58 28 L58 56 L22 56 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="2" strokeLinejoin="round" />
      {/* Paper insert */}
      <rect x="26" y="22" width="28" height="20" rx="1" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
      {/* Archive Folder front */}
      <path d="M20 32 L60 32 L56 58 L24 58 Z" fill="#f87171" stroke="#991b1b" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Red Ribbon Bookmark */}
      <path d="M48 24 L48 40 L52 37 L56 40 L56 24 Z" fill="#991b1b" />
    </svg>
  );
}

/** Custom fallback 0: Trophy */
function TrophyIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      <path d="M30 58 L50 58 M40 46 L40 58" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 22 L52 22 L48 42 C48 45 42 46 40 46 C38 46 32 45 32 42 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
      <path d="M28 24 C20 24 20 34 28 36" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
      <path d="M52 24 C60 24 60 34 52 36" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Custom fallback 1: Rocket */
function RocketIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      <path d="M40 16 C30 24 28 42 32 52 L48 52 C52 42 50 24 40 16 Z" fill="#ea580c" stroke="#9a3412" strokeWidth="2" />
      <circle cx="40" cy="32" r="4" fill="#e0f2fe" stroke="#0369a1" strokeWidth="1.5" />
      <path d="M28 42 L20 48 L28 50 Z" fill="#f97316" stroke="#9a3412" strokeWidth="1.5" />
      <path d="M52 42 L60 48 L52 50 Z" fill="#f97316" stroke="#9a3412" strokeWidth="1.5" />
      <path d="M36 52 Q40 64 44 52" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
    </svg>
  );
}

/** Custom fallback 2: Compass */
function CompassIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      <circle cx="40" cy="40" r="18" fill="#ffffff" stroke="#4d7c0f" strokeWidth="2.5" />
      <polygon points="40,26 44,38 40,40" fill="#ef4444" />
      <polygon points="40,54 36,42 40,40" fill="#64748b" />
      <circle cx="40" cy="40" r="2" fill="#1e293b" />
    </svg>
  );
}

/** Custom fallback 3: Lightbulb */
function LightbulbIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      <path d="M30 32 C30 22 50 22 50 32 C50 38 45 42 45 46 L35 46 C35 42 30 38 30 32 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
      <rect x="36" y="48" width="8" height="6" rx="1" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
      <path d="M40 26 L40 36 M35 32 L45 32" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Custom fallback 4: Shield */
function ShieldIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      <path d="M40 18 L56 24 C56 42 40 56 40 56 C40 56 24 42 24 24 Z" fill="#64748b" stroke="#334155" strokeWidth="2" />
      <path d="M40 22 L52 26 C52 40 40 50 40 50 Z" fill="#94a3b8" opacity="0.6" />
    </svg>
  );
}

/** Custom fallback 5: Briefcase */
function BriefcaseIllustration() {
  return (
    <svg viewBox="0 0 80 80" className="size-16 select-none overflow-visible drop-shadow-sm">
      <path d="M34 24 L46 24 L46 20 L34 20 Z" fill="none" stroke="#be185d" strokeWidth="2" />
      <rect x="22" y="24" width="36" height="28" rx="3" fill="#ec4899" stroke="#9d174d" strokeWidth="2" />
      <line x1="22" y1="36" x2="58" y2="36" stroke="#be185d" strokeWidth="1.5" />
      <circle cx="40" cy="36" r="2.5" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
    </svg>
  );
}

function StageArt({ type }: { type: StageTheme["type"] }) {
  switch (type) {
    case "wishlist":
      return <WishlistIllustration />;
    case "preparing":
      return <PreparingIllustration />;
    case "applied":
      return <MailboxIllustration />;
    case "screening":
      return <ScreeningIllustration />;
    case "interview":
      return <InterviewIllustration />;
    case "assessment":
      return <AssessmentIllustration />;
    case "offer":
      return <OfferIllustration />;
    case "hired":
      return <HiredIllustration />;
    case "target":
      return <TargetIllustration />;
    case "unsorted":
      return <UnsortedIllustration />;
    case "rejected":
      return <RejectedIllustration />;
    case "custom-0":
      return <TrophyIllustration />;
    case "custom-1":
      return <RocketIllustration />;
    case "custom-2":
      return <CompassIllustration />;
    case "custom-3":
      return <LightbulbIllustration />;
    case "custom-4":
      return <ShieldIllustration />;
    case "custom-5":
    default:
      return <BriefcaseIllustration />;
  }
}

/**
 * Organic, natural, unstructured blob with Frosted Glass styling:
 * - Fluid translucent pastel gradient
 * - Ambient colored blur glow
 * - Specular glass highlight rim & reflection
 */
function FrostedGlassBlob({
  fromColor,
  toColor,
  shapeIndex,
  isHovered,
  children,
}: {
  fromColor: string;
  toColor: string;
  shapeIndex: number;
  isHovered: boolean;
  children: React.ReactNode;
}) {
  const blobPaths = [
    "M34 16 C52 10 76 18 84 36 C92 54 82 74 66 84 C50 94 26 90 14 74 C2 58 10 36 22 22 C26 17 30 17 34 16 Z",
    "M46 14 C66 12 84 26 88 46 C92 66 76 84 54 88 C32 92 12 80 8 58 C4 36 18 18 36 14 C40 13 42 14 46 14 Z",
    "M30 18 C50 12 74 14 86 32 C98 50 88 74 72 86 C56 98 28 92 16 78 C4 64 6 42 16 26 C20 19 24 19 30 18 Z",
    "M42 12 C64 10 80 24 86 42 C92 60 84 80 66 88 C48 96 24 88 12 72 C0 56 6 34 20 18 C26 11 34 12 42 12 Z",
    "M36 14 C56 8 78 20 86 38 C94 56 82 78 64 86 C46 94 22 86 12 70 C2 54 8 32 22 18 C26 14 30 15 36 14 Z",
    "M44 16 C62 14 80 26 86 46 C92 66 78 86 58 90 C38 94 16 84 10 64 C4 44 14 24 32 16 C36 14 40 15 44 16 Z",
  ];

  const blobPath = blobPaths[shapeIndex % blobPaths.length];
  const gradId = `glass-blob-grad-${shapeIndex}-${fromColor.replace("#", "")}`;
  const filterId = `glass-blur-${shapeIndex}-${fromColor.replace("#", "")}`;

  return (
    <div className="relative my-2 flex size-24 items-center justify-center">
      {/* Organic Frosted Glass Blob Background */}
      <svg
        viewBox="0 0 100 100"
        className={`absolute inset-0 size-full transition-all duration-300 pointer-events-none ${
          isHovered ? "scale-110" : "scale-100"
        }`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={fromColor} stopOpacity="0.45" />
            <stop offset="60%" stopColor={toColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
          </linearGradient>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
          </filter>
        </defs>

        {/* 1. Ambient colored soft shadow glow behind organic blob */}
        <path
          d={blobPath}
          fill={fromColor}
          filter={`url(#${filterId})`}
          className="transition-opacity duration-300"
          opacity={isHovered ? 0.7 : 0.35}
        />

        {/* 2. Frosted Glass Body */}
        <path
          d={blobPath}
          fill={`url(#${gradId})`}
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/60 dark:text-white/20 drop-shadow-xs"
        />

        {/* 3. Glass specular highlight sheen */}
        <path
          d={blobPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="1.2"
          strokeDasharray="16 36"
          strokeLinecap="round"
        />
      </svg>

      {/* Floating Center Vector Illustration */}
      <div
        className={`relative z-10 transition-transform duration-300 ${
          isHovered ? "scale-110 -translate-y-1 drop-shadow-md" : "scale-100"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** Hand-drawn curved connector arrow between pipeline stages */
function HandDrawnConnectorArrow({
  startX,
  endX,
  index,
}: {
  startX: number;
  endX: number;
  index: number;
}) {
  const isWaveUp = index % 2 === 0;
  const startY = 25;
  const endY = isWaveUp ? 22 : 28;
  const midX = (startX + endX) / 2;
  const controlY = isWaveUp ? 12 : 38;

  return (
    <g className="text-slate-400/80 dark:text-slate-500/80">
      {/* Hand-drawn curved shaft */}
      <path
        d={`M ${startX}% ${startY} Q ${midX}% ${controlY} ${endX}% ${endY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Hand-drawn arrowhead top barb */}
      <path
        d={`M ${endX - 1.2}% ${endY - 5} Q ${endX - 0.4}% ${endY - 2} ${endX}% ${endY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Hand-drawn arrowhead bottom barb */}
      <path
        d={`M ${endX - 1.2}% ${endY + 5} Q ${endX - 0.4}% ${endY + 2} ${endX}% ${endY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

/**
 * Pipeline Journey Map: Illustrated milestone path with organic winding trail and pebble stepping stones.
 */
export function PipelineStages({ stages, total }: { stages: PipelineStage[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  if (stages.length === 0) {
    return null;
  }

  const stageWidth = 145; // Width per stage column in px
  const totalTrackWidth = stages.length * stageWidth;

  return (
    <div className="w-full select-none">
      <div className="relative w-full overflow-x-auto pb-4 pt-2 scrollbar-minimal">
        <div
          className="relative flex items-start justify-between min-w-[780px]"
          style={{ minWidth: `${Math.max(780, totalTrackWidth)}px` }}
        >
          {/* Dynamic SVG Hand-Drawn Connector Arrows */}
          <svg
            className="absolute left-0 top-[45px] w-full pointer-events-none overflow-visible z-0"
            height="50"
            style={{ width: "100%" }}
          >
            {stages.slice(0, -1).map((_, i) => {
              const startX = (i + 0.5) * (100 / stages.length) + (100 / stages.length) * 0.26;
              const endX = (i + 1.5) * (100 / stages.length) - (100 / stages.length) * 0.26;
              return (
                <HandDrawnConnectorArrow
                  key={`arrow-${i}`}
                  startX={startX}
                  endX={endX}
                  index={i}
                />
              );
            })}
          </svg>

          {/* Milestone Columns */}
          {stages.map((stage, i) => {
            const share = total > 0 ? (stage.count / total) * 100 : 0;
            const formattedShare = share > 0 ? (share % 1 === 0 ? `${share}%` : `${share.toFixed(1)}%`) : "0%";
            const theme = getStageTheme(stage.name, i);
            const isHovered = active === stage.id;
            const isDim = stage.count === 0 && active !== null && !isHovered;

            return (
              <motion.div
                key={stage.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: isDim ? 0.45 : 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: shouldReduceMotion ? 0 : i * 0.04,
                }}
                onMouseEnter={() => setActive(stage.id)}
                onMouseLeave={() => setActive(null)}
                className="relative z-10 flex flex-1 flex-col items-center justify-start text-center px-2 cursor-pointer transition-opacity duration-200 group"
              >
                {/* 1. Frosted Glass Organic Blob with Thematic Vector Art */}
                <FrostedGlassBlob
                  fromColor={theme.gradFrom}
                  toColor={theme.gradTo}
                  shapeIndex={i}
                  isHovered={isHovered}
                >
                  <StageArt type={theme.type} />
                </FrostedGlassBlob>

                {/* 2. Stage Title */}
                <div className="mt-1 font-heading text-sm font-bold text-foreground tracking-tight max-w-[120px] truncate">
                  {stage.name}
                </div>

                {/* 3. Job Count */}
                <div className={`mt-0.5 text-xs font-bold ${theme.countText}`}>
                  {stage.count} {stage.count === 1 ? "job" : "jobs"}
                </div>

                {/* 4. Percentage Badge */}
                <div
                  className={`mt-2 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${theme.pillBg} ${theme.pillText}`}
                >
                  {formattedShare}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface BreakdownItem {
  label: string;
  count: number;
}

/**
 * Icons live here rather than on the item because a component function cannot
 * cross the RSC boundary — the server page sends labels and counts only.
 * Work-location and employment-type labels don't collide, so one map serves both.
 */
const breakdownIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Remote: House,
  Hybrid: Blend,
  "On-site": Building2,
  Unspecified: CircleHelp,
  "Full-time": Briefcase,
  "Part-time": Clock3,
  Contract: FileTextIcon,
  Freelance: Handshake,
  Internship: GraduationCap,
  Temporary: CalendarClock,
  Apprenticeship: GraduationCap,
  Volunteer: HeartHandshake,
};

/**
 * A category split in one bar plus a legend, sized for a half-width card.
 */
export function BreakdownBar({ items, total }: { items: BreakdownItem[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);

  if (total === 0) {
    return <p className="py-4 text-xs text-muted-foreground">No jobs yet</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {items.map((item, i) => (
          <div
            key={item.label}
            role="presentation"
            title={`${item.label}: ${item.count}`}
            onMouseEnter={() => setActive(item.label)}
            onMouseLeave={() => setActive(null)}
            className="h-full rounded-full transition-opacity duration-200 cursor-pointer"
            style={{
              width: `${(item.count / total) * 100}%`,
              backgroundColor: `var(--chart-${(i % 5) + 1})`,
              opacity: active && active !== item.label ? 0.35 : 1,
            }}
          />
        ))}
      </div>

      <div className="space-y-0.5">
        {items.map((item, i) => {
          const Icon = breakdownIcons[item.label] ?? CircleHelp;
          const isHovered = active === item.label;

          return (
            <div
              key={item.label}
              onMouseEnter={() => setActive(item.label)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${
                isHovered ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon
                  className="size-3.5 shrink-0"
                  style={{ color: `var(--chart-${(i % 5) + 1})` }}
                  aria-hidden="true"
                />
                <span className="truncate text-xs">{item.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-xs font-semibold text-foreground">{item.count}</span>
                <span className="w-9 text-right text-xs text-muted-foreground">
                  {Math.round((item.count / total) * 100)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface MatchScoreBand {
  /** "Strong" | "Fair" | "Weak" — same thresholds as matchScoreBand() in lib/types/board.ts. */
  label: string;
  count: number;
}

const scoreBandColor: Record<string, string> = {
  Strong: "var(--success)",
  Fair: "var(--warning)",
  Weak: "var(--destructive)",
};

export function MatchScoreDistributionChart({ data }: { data: MatchScoreBand[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No scored jobs yet</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} barCategoryGap="12%" margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="gradStrong" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="gradFair" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="gradWeak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.15 }} />
          <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={100} maxBarSize={130}>
            {data.map((entry) => {
              const fillUrl =
                entry.label === "Strong"
                  ? "url(#gradStrong)"
                  : entry.label === "Fair"
                    ? "url(#gradFair)"
                    : "url(#gradWeak)";
              return (
                <Cell
                  key={entry.label}
                  fill={fillUrl}
                  stroke={scoreBandColor[entry.label]}
                  strokeWidth={1.5}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs">
        {data.map((entry) => {
          const share = total > 0 ? Math.round((entry.count / total) * 100) : 0;
          return (
            <div key={entry.label} className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: scoreBandColor[entry.label] }} />
              <span className="text-muted-foreground">{entry.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{entry.count}</span>
              <span className="text-[11px] text-muted-foreground/80">({share}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ApplicationTrendChart({ data }: { data: TrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
        <defs>
          <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        {/* One tick per data point would crowd the axis once the trend is
            zero-filled to a full window — preserveStartEnd thins the rest to
            what actually fits instead of hardcoding a skip count tied to a
            30-day window that might not always be 30. */}
        <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="applications" stroke="var(--chart-1)" fillOpacity={1} fill="url(#colorApplications)" strokeWidth={2} />
        <Area type="monotone" dataKey="interviews" stroke="var(--chart-2)" fillOpacity={1} fill="url(#colorInterviews)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function McqScoreChart({ data }: { data: McqScoreData[] }) {
  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)", strokeWidth: 0, r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
