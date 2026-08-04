import { ShieldCheck, Database, Lock, Mail, Check, EyeOff } from "lucide-react";

export function Privacy() {
  return (
    <section
      id="privacy"
      className="relative scroll-mt-24 overflow-hidden bg-gradient-to-b from-primary/[0.04] to-background px-6 py-36"
    >
      <div className="absolute -left-40 top-24 size-96 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="absolute -right-40 bottom-24 size-96 rounded-full bg-emerald-500/[0.05] blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-4xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3" />
            Privacy & Security
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your data stays yours
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Aven is built private-first. Your jobs, applications, and notes are
            protected at the database, at rest, and on their way out.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Featured: private by design */}
          <article className="group relative flex flex-col overflow-hidden rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 sm:col-span-2">
            <div className="absolute -top-24 -right-24 size-64 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 opacity-70" />
            <div className="relative flex items-start justify-between">
              <div className="flex size-11 items-center justify-center rounded-4xl bg-emerald-500/10">
                <ShieldCheck className="size-5 text-emerald-500" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-600">
                <EyeOff className="size-3" />
                Visible only to you
              </span>
            </div>
            <h3 className="relative mt-5 font-heading text-lg font-semibold">
              Private by design
            </h3>
            <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Aven is a personal workspace, not a job board. Your jobs,
              applications, resumes, and interview notes belong to your account
              — and no one else&apos;s.
            </p>

            <div className="relative mt-6 flex-1 space-y-2">
              {["Job applications", "Interview notes", "Resumes", "Match scores"].map(
                (row, i) => (
                  <div
                    key={row}
                    className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-background px-3 py-2"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium">{row}</span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      <Lock className="size-3" />
                      {i === 0 ? "Locked" : "Private"}
                    </span>
                  </div>
                )
              )}
            </div>
          </article>

          {/* Row-level protection */}
          <article className="group relative overflow-hidden rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 hover:border-primary/30">
            <div className="absolute -top-16 -right-16 size-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex size-11 items-center justify-center rounded-4xl bg-primary/10">
              <Database className="size-5 text-primary" />
            </div>
            <h3 className="relative mt-5 font-heading text-base font-semibold">
              Row-level protection
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
              Every row of your data is locked to your account with row-level
              security — you can only ever access what belongs to you.
            </p>
          </article>

          {/* AES-256-GCM encryption */}
          <article className="group relative overflow-hidden rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 hover:border-pink-500/30">
            <div className="absolute -top-16 -right-16 size-40 rounded-full bg-pink-500/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex size-11 items-center justify-center rounded-4xl bg-pink-500/10">
              <Lock className="size-5 text-pink-500" />
            </div>
            <h3 className="relative mt-5 font-heading text-base font-semibold">
              AES-256-GCM encryption
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
              Your email password is encrypted at rest with AES-256-GCM and
              decrypted only at the moment it sends your application.
            </p>
          </article>

          {/* Send from your own inbox */}
          <article className="group relative flex flex-col overflow-hidden rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 sm:col-span-2">
            <div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-violet-500/10 blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-start justify-between">
              <div className="flex size-11 items-center justify-center rounded-4xl bg-violet-500/10">
                <Mail className="size-5 text-violet-500" />
              </div>
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                Gmail
              </span>
            </div>
            <h3 className="relative mt-5 font-heading text-lg font-semibold">
              Send from your own inbox
            </h3>
            <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Application emails go out through your own SMTP account, from your
              own address. Aven never sends on its own behalf.
            </p>

            <div className="relative mt-6 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex size-6 items-center justify-center rounded-full bg-violet-500/10">
                  <ShieldCheck className="size-3.5 text-violet-500" />
                </div>
                <span className="text-xs font-medium">Your SMTP</span>
              </div>
              <span className="text-muted-foreground/40">&rarr;</span>
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="size-3.5 text-emerald-500" />
                </div>
                <span className="text-xs font-medium">Recruiter</span>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-4xl border border-border/60 bg-card/60 px-6 py-5">
          {["No ads", "No data resale", "No third-party trackers"].map((item) => (
            <span
              key={item}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Check className="size-4 text-emerald-500" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
