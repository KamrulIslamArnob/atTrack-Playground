"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeLabels: Record<string, string> = {
  overview: "Overview",
  board: "Board",
  jobs: "Jobs",
  applications: "Applications",
  interviews: "Interviews",
  documents: "Document",
  document: "Document",
  network: "Network",
  crm: "Network",
  resources: "Resources",
  links: "Resources",
  prompts: "Prompts",
  "ai-prompts": "Prompts",
  settings: "Settings",
  preferences: "Preferences",
  insights: "Insights",
  admin: "Admin",
};

export function Breadcrumbs(_props?: { labels?: Record<string, string> }) {
  return null;
}
