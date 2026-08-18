# Pipeline Journey Map — Design Specification

## 1. Overview & Goals
Transform the traditional flat progress bar & grid cards in the dashboard Overview (`/overview`) into an illustrated **Winding Milestone Journey** matching the reference visual style:
- Organic winding dashed trail with pebble stepping stones connecting stages.
- Numbered circular badge (1, 2, 3...) with pastel thematic color coding.
- Soft watercolor / cloud blob backdrop behind each stage's focal illustration.
- Stage Title, colored job count (`X jobs`), and percentage badge (`X%`).
- Seamless support for dynamic lists from database (`Wishlist`, `Preparing`, `Applied`, `Screening`, `Interview`, `Assessment`, `Offer`, `Hired`, `Rejected`).
- Full dark mode & light mode support, accessible keyboard navigation, and responsive horizontal panning when screen width is constrained.

---

## 2. Visual Architecture & Layout

### 2.1 The Winding Trail (SVG Canvas)
- A dynamic SVG bezier curve (`M ... C ... S ...`) spans horizontally across the pipeline nodes.
- Dashed stroke pattern (`stroke-dasharray="4 4"`) with slight organic amplitude oscillation between stages.
- Small stepping-stone pebbles rendered along the trail at curve inflection points.

### 2.2 Milestone Node Anatomy
Each stage column renders:
1. **Top Step Number**: Circle pill (`size-7`), soft pastel tint background with colored bold number (1, 2, 3...).
2. **Focal Illustration Area**:
   - Organic watercolor blob background (`<svg>` fluid organic polygon/path with soft gradient & subtle drop shadow).
   - Thematic illustrated icon in the center (e.g. Mailbox for Applied, Magnifier for Screening, Chat for Interview, Checklist for Assessment, Heart Envelope for Offer, Party Popper for Hired).
3. **Stage Title**: Font semibold/medium, dark foreground text.
4. **Job Count**: Bold colored text (`X jobs` or `1 job`) matching stage theme.
5. **Percentage Pill**: Rounded full pill (`bg-color/15 text-color px-2.5 py-0.5 text-xs font-semibold`) showing stage distribution %.

---

## 3. Stage Theming & Iconography Mapping

| Stage Category / Keyword | Step Color Scheme | Watercolor Blob Tone | Icon |
| :--- | :--- | :--- | :--- |
| **Wishlist / Saved** | Slate / Gray | `#e2e8f0` / `dark:#334155` | Star / Bookmark |
| **Preparing / Draft** | Amber / Orange | `#fef3c7` / `dark:#78350f` | Edit / Compass |
| **Applied / Sent** | Blue / Indigo | `#dbeafe` / `dark:#1e3a8a` | Mailbox / Send |
| **Screening / Review** | Gold / Yellow | `#fef9c3` / `dark:#713f12` | Magnifier / Search |
| **Interview / Rounds** | Sky / Cyan | `#e0f2fe` / `dark:#075985` | Chat Bubbles / Video |
| **Assessment / Test** | Mint / Green | `#dcfce7` / `dark:#14532d` | Checklist / FileText |
| **Offered / Offer** | Violet / Purple | `#ede9fe` / `dark:#581c87` | Heart Envelope / Gift |
| **Hired / Accepted** | Rose / Pink | `#ffe4e6` / `dark:#881337` | Party Popper / Trophy |
| **Rejected / Archive** | Coral / Red | `#fee2e2` / `dark:#7f1d1d` | Archive / Cross |

---

## 4. Component Structure

### File Changes:
- **`components/overview-charts.tsx`**:
  - Replace current `PipelineStages` with `PipelineJourneyMap` containing dynamic SVG winding path, illustrated milestones, stepping stones, and interactive state.
  - Retain `PipelineStage` interface for backward compatibility with `app/(dashboard)/overview/page.tsx`.
- **`app/(dashboard)/overview/page.tsx`**:
  - Update `Pipeline` card wrapper to seamlessly house the new journey map with smooth horizontal scroll container if viewport is compact.

---

## 5. Verification & Testing
- Test with 0 jobs (empty state).
- Test with standard 4-6 pipeline stages.
- Test with custom / long list of stages (smooth scrolling and curve alignment).
- Test light mode and dark mode styling.
- Run `npm run build` to verify 0 TypeScript/Next.js errors.
