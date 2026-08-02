import Link from "next/link";
import { Briefcase, Target, Calendar, FileText } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Aven
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your job search,<br />organized.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Track applications, schedule interviews, and manage your career
            — all in one private workspace.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Start for free
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="border-t border-border px-6 py-16">
          <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Briefcase, title: "Job tracker", desc: "Save and track every opportunity." },
              { icon: Target, title: "Applications", desc: "Monitor status from first touch to offer." },
              { icon: Calendar, title: "Interviews", desc: "Never miss a scheduled call." },
              { icon: FileText, title: "Documents", desc: "Resumes and cover letters in one place." },
            ].map((item) => (
              <div key={item.title} className="space-y-2">
                <item.icon className="size-5 text-muted-foreground" />
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6">
        <p className="text-center text-xs text-muted-foreground">
          Aven &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
