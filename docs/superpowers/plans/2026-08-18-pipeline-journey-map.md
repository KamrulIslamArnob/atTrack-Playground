# Pipeline Journey Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Pipeline block in `/overview` from flat progress bars into an illustrated Winding Milestone Journey with dynamic SVG curves, watercolor blob backdrops, step numbers, counts, and percentage pills.

**Architecture:** Create a self-contained, responsive `PipelineJourneyMap` component with SVG path generation and thematic milestone nodes, integrated directly into `components/overview-charts.tsx` and consumed by `app/(dashboard)/overview/page.tsx`.

**Tech Stack:** React, Next.js 16 (App Router), Tailwind CSS, Lucide React icons, Framer Motion (`motion/react`).

## Global Constraints
- Must preserve `PipelineStage` type and existing props for backward compatibility.
- Zero external image assets: all visuals (winding path, watercolor blobs, stepping stones, icons) rendered via dynamic responsive SVGs & CSS for instant load time and crisp resolution in both Light and Dark modes.
- Responsive horizontal panning when stages exceed container width on mobile/tablet.

---

### Task 1: Build `PipelineJourneyMap` in `components/overview-charts.tsx`

**Files:**
- Modify: `components/overview-charts.tsx`

**Interfaces:**
- Consumes: `PipelineStage[]`, `total: number`
- Produces: `<PipelineStages stages={pipelineStages} total={total} />` with the new winding journey design.

- [ ] **Step 1: Implement SVG Winding Curve, Milestone Nodes & Watercolor Blobs**
  - Define stage configuration mapping keywords (wishlist, prep, applied, screen, interview, assessment, offer, hire, reject) to pastel themes, watercolor gradient blobs, and lucide icons (Mailbox/Send, Magnifier, Messages, Checklist, HeartEnvelope, PartyPopper).
  - Calculate dynamic sine/bezier curve connecting milestone center points with dashed trail (`stroke-dasharray="4 4"`) and pebble stepping stones.
  - Render node header with pastel step number capsule (1..N).
  - Render node footer with stage title, colored bold `X jobs` count, and percentage pill (`X%`).

- [ ] **Step 2: Add interactive hover states and reduced-motion support**
  - Node hover highlights watercolor blob and count.
  - Active node syncs smoothly without layout shifts.

- [ ] **Step 3: Verification**
  - Verify layout in `app/(dashboard)/overview/page.tsx`.

---

### Task 2: Update Overview Card & Verification

**Files:**
- Modify: `app/(dashboard)/overview/page.tsx`

- [ ] **Step 1: Ensure responsive horizontal scrolling container and padding**
  - Ensure card container has `overflow-x-auto scrollbar-minimal` so the journey map remains legible and gracefully scrollable on smaller screens.

- [ ] **Step 2: Build verification**
  - Run `npm run build` to verify 0 TypeScript and Next.js compiler errors.
