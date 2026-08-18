"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Slots into "Couldn't load {label}" — pass a lowercase noun, e.g. "network". */
  label: string;
}

interface State {
  error: Error | null;
}

/**
 * One malformed field on one job (a legacy contact, a hand-typed note) can
 * throw during render. Without this, that throw bubbles past all four tabs
 * to app/(dashboard)/error.tsx and blanks the whole job — title, other tabs,
 * everything — for a problem confined to one section. This catches it at
 * the tab, so "Try again" only re-renders that section and the rest of the
 * page stays usable. Same fallback language as the route-level boundary,
 * scaled down to fit inside a tab panel instead of a full page.
 */
export class TabErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[TabErrorBoundary:${this.props.label}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-destructive" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Couldn&apos;t load {this.props.label}</h3>
            <p className="text-xs text-muted-foreground">Something went wrong loading this section.</p>
          </div>
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            <RotateCCWIcon className="size-3.5" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
