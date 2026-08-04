import { Lock } from "lucide-react";

export function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-24 bg-gradient-to-b from-primary/[0.04] to-background px-6 py-36">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-4xl bg-primary/10 ring-1 ring-inset ring-primary/10">
          <Lock className="size-6 text-primary" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          Your data stays yours
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Aven is a private workspace, not a job board. Your applications,
          resumes, and interview notes are encrypted and never shared with
          third parties.
        </p>
      </div>
    </section>
  );
}
