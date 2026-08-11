"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const reactId = useId();
  const id = `resume-color-${reactId}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <Input
          aria-label={`${label} hex value`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 border-0 px-1 font-mono text-xs shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
