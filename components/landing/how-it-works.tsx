import { Camera, Mail, Briefcase } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Import",
    description:
      "Screenshot a job posting or paste a URL. AI extracts every detail — title, company, salary, requirements, and how to apply.",
    icon: Camera,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    step: "02",
    title: "Compose",
    description:
      "AI writes a personalized email tailored to the role and your experience. Edit, preview, and attach your resume.",
    icon: Mail,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    step: "03",
    title: "Track",
    description:
      "Send the email and watch your application move through the pipeline. From submitted to interview to offer.",
    icon: Briefcase,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border/50 bg-gradient-to-b from-primary/[0.03] to-background px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            From screenshot to sent
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Three steps. No copy-pasting. No tab-switching. Just you and
            your next career move.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="relative text-center">
              <div className={`mx-auto flex size-14 items-center justify-center rounded-4xl ${item.bg} ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04]`}>
                <item.icon className={`size-6 ${item.color}`} />
              </div>
              <div className="mt-6 font-heading text-4xl font-bold text-primary/20">
                {item.step}
              </div>
              <h3 className="mt-2 font-heading text-lg font-semibold">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
