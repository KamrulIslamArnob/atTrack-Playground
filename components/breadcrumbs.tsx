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
  documents: "Resume/CV",
  crm: "CRM",
  settings: "Settings",
  insights: "Insights",
  admin: "Admin",
};

export function Breadcrumbs({ labels }: { labels?: Record<string, string> }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const isAdmin = segments[0] === "admin";

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = labels?.[segment] ?? routeLabels[segment] ?? segment;
    const isLast = index === segments.length - 1;

    return { href, label, isLast };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={isAdmin ? "/admin" : "/overview"} />}>
            {isAdmin ? "Admin" : "Home"}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.slice(isAdmin ? 1 : 0).map((crumb) => (
          <Fragment key={crumb.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={crumb.href} />}>
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
