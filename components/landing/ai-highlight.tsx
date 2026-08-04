import { Sparkles, Camera, Mail, Check } from "lucide-react";

export function AiHighlight() {
  return (
    <section id="ai" className="scroll-mt-24 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-4xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3" />
              AI-Powered
            </div>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">
              Stop copy-pasting
              <br />
              job details
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Paste a screenshot of any job posting and our AI extracts
              everything — title, company, salary, location, requirements,
              and how to apply. Structured data in seconds, not minutes.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Multi-image support for long postings",
                "Automatic company detection and matching",
                "Match score against your resume",
                "One-click save to your pipeline",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Check className="size-3 text-primary" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-4xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03] p-6 shadow-xl shadow-primary/5">
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-3xl bg-primary/5 p-3 ring-1 ring-inset ring-primary/10">
                <div className="flex size-10 items-center justify-center rounded-3xl bg-primary/15">
                  <Camera className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="h-3 w-32 rounded-full bg-primary/15" />
                  <div className="mt-2 h-2 w-48 rounded-full bg-primary/8" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-border/60 bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Title
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    Senior Flutter Developer
                  </div>
                </div>
                <div className="rounded-3xl border border-border/60 bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Company
                  </div>
                  <div className="mt-1 text-sm font-medium">XpertLab</div>
                </div>
                <div className="rounded-3xl border border-border/60 bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Salary
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    $80k — $120k
                  </div>
                </div>
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600/70">
                    Match
                  </div>
                  <div className="mt-1 text-sm font-semibold text-emerald-600">
                    87% match
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-border/60 bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  How to apply
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="size-3.5" />
                  hr@xpertlab.com
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
