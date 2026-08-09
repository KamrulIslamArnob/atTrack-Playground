export interface ActivityLogLike {
  action: string;
  resource: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
}

export function normalizeIpAddress(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "127.0.0.1") {
    return "localhost";
  }
  return ip;
}

const RESOURCE_LABELS: Record<string, string> = {
  auth: "account",
  job: "job",
  application: "application",
  interview: "interview",
  document: "document",
  email: "email",
  mcq_result: "MCQ test",
  screenshot: "screenshot",
  job_import: "job import",
  profile: "profile",
  avatar: "avatar",
  smtp: "SMTP settings",
  ai_provider: "AI provider",
  ai_task_route: "AI task routing",
  user: "user",
  board_list: "board list",
  position: "position",
  onboarding: "onboarding",
  contact: "contact",
  company: "company",
  job_document: "document",
  job_contact: "contact",
};

const ACTION_LABELS: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  send: "sent",
  upload: "uploaded",
  extract: "extracted",
  sign_in: "signed in",
  sign_up: "signed up",
  sign_out: "signed out",
  account_deletion: "deleted account",
  ban: "banned",
  unban: "unbanned",
  promote: "promoted",
  demote: "demoted",
  save: "saved",
  remove: "removed",
  move_card: "moved",
  complete: "completed",
  link: "linked",
  unlink: "unlinked",
  log: "logged",
};

export const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  delete: "bg-red-100 text-red-700",
  update: "bg-blue-100 text-blue-700",
  send: "bg-purple-100 text-purple-700",
  upload: "bg-orange-100 text-orange-700",
  extract: "bg-cyan-100 text-cyan-700",
  sign_in: "bg-indigo-100 text-indigo-700",
  sign_up: "bg-emerald-100 text-emerald-700",
  sign_out: "bg-gray-100 text-gray-700",
  account_deletion: "bg-red-100 text-red-700",
  ban: "bg-red-100 text-red-700",
  unban: "bg-green-100 text-green-700",
  promote: "bg-purple-100 text-purple-700",
  demote: "bg-orange-100 text-orange-700",
  save: "bg-blue-100 text-blue-700",
  remove: "bg-gray-100 text-gray-700",
  move_card: "bg-violet-100 text-violet-700",
  complete: "bg-emerald-100 text-emerald-700",
};

function firstString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (value != null && value !== "") return String(value);
  }
  return null;
}

function describeUser(metadata: Record<string, unknown>): string {
  const email = firstString(metadata, ["email", "target_email"]);
  const name = firstString(metadata, ["full_name", "target_name"]);
  if (name && email) return `${name} (${email})`;
  return name ?? email ?? "a user";
}

export function formatActivityMessage(log: ActivityLogLike): string {
  const { action, resource, resource_id, metadata } = log;
  const meta = metadata ?? {};

  switch (action) {
    case "sign_in":
      return "Signed in";
    case "sign_up":
      return "Signed up";
    case "sign_out":
      return "Signed out";
    case "account_deletion":
      return "Deleted their account";
    case "ban":
      return `Banned ${describeUser(meta)}`;
    case "unban":
      return `Unbanned ${describeUser(meta)}`;
    case "promote":
      return `Promoted ${describeUser(meta)} to admin`;
    case "demote":
      return `Demoted ${describeUser(meta)}`;
  }

  const verb = ACTION_LABELS[action] ?? action;
  const label = RESOURCE_LABELS[resource] ?? resource;

  switch (resource) {
    case "job": {
      const title = firstString(meta, ["title"]);
      const company = firstString(meta, ["company"]);
      if (action === "move_card") {
        const listName = firstString(meta, ["list_name"]);
        if (title && listName) return `Moved "${title}" to ${listName}`;
        return listName ? `Moved a job to ${listName}` : "Moved a job on the board";
      }
      // "Log Other Activity" on the job-detail-sheet: metadata.title is the
      // entry's own title, not the job's — distinct from every other job action.
      if (action === "log") return title ?? "Logged an activity";
      if (action === "update" && meta.resume_id !== undefined) {
        return meta.resume_id ? "Attached a resume" : "Removed the attached resume";
      }
      if (action === "update" && meta.project_links_count !== undefined) {
        return "Updated project links";
      }
      if (title && company) return `${capitalize(verb)} job "${title}" at ${company}`;
      if (title) return `${capitalize(verb)} job "${title}"`;
      return `${capitalize(verb)} a job`;
    }
    case "contact": {
      const name = firstString(meta, ["name"]);
      if (action === "link") return "Linked a contact to a company";
      return name ? `${capitalize(verb)} contact "${name}"` : `${capitalize(verb)} a contact`;
    }
    case "company": {
      const name = firstString(meta, ["name"]);
      return name ? `${capitalize(verb)} company "${name}"` : `${capitalize(verb)} a company`;
    }
    case "job_contact": {
      return action === "unlink" ? "Removed a contact" : "Linked a contact";
    }
    case "job_document": {
      return action === "unlink" ? "Removed a linked document" : "Linked a document";
    }
    case "board_list": {
      const name = firstString(meta, ["name"]);
      return name ? `${capitalize(verb)} board list "${name}"` : `${capitalize(verb)} a board list`;
    }
    case "position": {
      const name = firstString(meta, ["name"]);
      return name ? `${capitalize(verb)} position "${name}"` : `${capitalize(verb)} a position`;
    }
    case "onboarding":
      return "Completed onboarding";
    case "application": {
      if (action === "update") {
        const status = firstString(meta, ["status"]);
        return status ? `Updated application status to "${status}"` : "Updated application";
      }
      return `${capitalize(verb)} an application`;
    }
    case "interview": {
      const jobTitle = firstString(meta, ["job_title", "job"]);
      return jobTitle ? `${capitalize(verb)} interview for "${jobTitle}"` : `${capitalize(verb)} an interview`;
    }
    case "document": {
      const name = firstString(meta, ["name"]);
      if (action === "create") return name ? `Uploaded document "${name}"` : "Uploaded a document";
      return `${capitalize(verb)} a document`;
    }
    case "email": {
      const to = firstString(meta, ["to"]);
      return to ? `Sent email to ${to}` : "Sent an email";
    }
    case "screenshot": {
      if (action === "delete") return "Deleted screenshots";
      return "Uploaded a screenshot";
    }
    case "job_import": {
      const screenshots = firstString(meta, ["screenshots"]);
      const shots = screenshots ? Number(screenshots) : 0;
      const sources = [
        shots > 0 ? (shots > 1 ? "screenshots" : "a screenshot") : null,
        meta.hasUrl === true ? "a link" : null,
        meta.hasText === true ? "pasted text" : null,
      ].filter((s): s is string => s !== null);
      if (sources.length === 0) return "Extracted job details";
      return `Extracted job details from ${sources.join(" and ")}`;
    }
    case "mcq_result": {
      const score = firstString(meta, ["score"]);
      const total = firstString(meta, ["total"]);
      return score ? `Completed MCQ test (${score}/${total ?? "?"})` : "Completed an MCQ test";
    }
    case "avatar":
      return "Uploaded avatar";
    case "smtp":
      return action === "delete" || action === "remove"
        ? "Removed SMTP settings"
        : "Saved SMTP settings";
    default:
      return `${capitalize(verb)} ${label}${resource_id ? ` (${resource_id.slice(0, 8)})` : ""}`;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
