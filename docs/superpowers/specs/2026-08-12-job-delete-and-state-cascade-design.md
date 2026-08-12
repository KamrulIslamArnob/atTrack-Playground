# Design Specification: Smart Job Deletion with Cascading Rules & Job State Management

**Date:** 2026-08-12  
**Status:** Approved  

## Overview
This design introduces two major enhancements to job management in **atTrack**:
1. **Smart Job Deletion (Company Tab & Server Cascade)**: A "Delete Job" option in the Company tab (and card menus) that safely cascade-deletes uniquely linked companies, contacts, and documents while preserving entities shared across multiple jobs.
2. **Job State Management (Active, On Hold, Archive)**: A "Change State" control that lets users mark jobs as Active, On Hold, or Archived. On the Kanban board, active jobs stay prominent at the top, while On Hold and Archived jobs are housed in collapsible drawers at the bottom of each column with black-and-white visual styling that lights up on hover.

---

## 1. Database & Type Definitions

### 1.1 SQLite Schema (`lib/db/schema.sql` & `lib/db/sqlite.ts`)
- Add a `state` column to the `jobs` table:
  ```sql
  ALTER TABLE jobs ADD COLUMN state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'on_hold', 'archived'));
  ```
- Migration check in `lib/db/sqlite.ts`: Ensure existing databases are updated via `PRAGMA table_info(jobs)` check.

### 1.2 TypeScript Models (`lib/types/job.ts` & `lib/types/board.ts`)
- Define `JobState`:
  ```ts
  export type JobState = 'active' | 'on_hold' | 'archived';
  ```
- Update `BoardCard` and `JobDetailData['job']` to include `state: JobState`.

---

## 2. Smart Cascading Delete Engine (`lib/actions/jobs.ts`)

### 2.1 Action: `deleteJobWithSmartCascade(jobId: string)`
1. **Security & Authentication**: Retrieve `userId` from `getUser()`. Verify ownership of target `jobId`.
2. **Cascading Dependencies Verification**:
   - **Company (`companies`)**: Check `SELECT COUNT(*) FROM jobs WHERE company_id = ? AND id != ?`. If `count === 0`, queue company for deletion.
   - **Contacts (`contacts` & `job_contacts`)**: Remove `job_contacts` rows for this `jobId`. For each affected contact:
     - Check if it is linked to any remaining jobs in `job_contacts`.
     - Check if it belongs to a surviving company in `contacts.company_id`.
     - If unreferenced, delete the `contacts` row.
   - **Documents (`documents` & `job_documents`)**: Remove `job_documents` rows for this `jobId`. Clear `jobs.resume_id` / `jobs.matched_resume_id`. For each affected document:
     - Check if referenced in `jobs`, `positions`, or `job_documents`, or marked `is_default = 1`.
     - If unreferenced, delete the `documents` row and remove the file from storage.
   - **1-to-1 Job Entities**: Delete `applications`, `interviews`, `application_emails`, `job_deadlines` where `job_id = jobId`.
3. **Delete Job Record**: Delete from `jobs WHERE id = jobId AND user_id = userId`.
4. **Revalidate**: Revalidate paths `/board`, `/jobs`, `/crm`.

---

## 3. UI Components & Interactivity

### 3.1 Company Tab (`components/job-detail/tabs/company-tab.tsx`)
- Add a **Delete Job** button at the bottom of the Company Tab.
- Trigger `useConfirm` dialog warning:
  > *"Are you sure you want to delete this job? If this is the only job for [Company], the company record and unshared contacts/documents will also be deleted."*

### 3.2 Job State Selector ("Change State")
- Add a **Change State** dropdown button in `JobDetailContent` header next to the *Move* button.
- Add **Change State** submenu in `BoardCardItem` dropdown menu.
- Action `updateJobState(jobId: string, state: JobState)` updates `jobs.state` and revalidates board data.

### 3.3 Board Layout & Collapsible Drawers (`components/board/board-column.tsx`)
- Group column cards by `state`:
  - **Active Cards (`state === 'active'`)**: Main area at the top of the column.
  - **Visual Divider**: Subtle space separating active cards from state drawers.
  - **On Hold Drawer**: Collapsible section header `On Hold (count)` at the bottom of the column.
  - **Archived Drawer**: Collapsible section header `Archived (count)` at the bottom of the column.

### 3.4 Card Styling (`components/board/board-card.tsx`)
- Active cards: Standard visual design with full color badges and highlights.
- On Hold / Archived cards:
  - Applied CSS classes: `grayscale contrast-90 opacity-75 transition-all duration-300 hover:grayscale-0 hover:opacity-100 hover:shadow-md`.
  - When hovered, black-and-white filter lifts, revealing original colors and highlighting the card.

---

## 4. Verification & Testing Strategy
1. **Cascade Verification**:
   - Create a test job for "Company A" with a unique contact and document. Delete job -> verify job, company, contact, document are all deleted.
   - Create two test jobs for "Company B" with a shared contact. Delete job 1 -> verify job 1 is deleted, but Company B and shared contact remain.
2. **State Change & Board Layout Verification**:
   - Change job state to "On Hold" and "Archived".
   - Verify cards move to collapsible drawers at the bottom of the column.
   - Verify black-and-white grayscale appearance and hover color light-up effect.
