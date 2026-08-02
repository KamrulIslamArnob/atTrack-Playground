import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>
        <h1 className="mt-6 font-heading text-4xl font-semibold tracking-tight">
          404
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page could not be found.
        </p>
        <Link
          href="/overview"
          className={buttonVariants({ size: "sm", className: "mt-6" })}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
