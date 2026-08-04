import { Star, Quote } from "lucide-react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Data Scientist at Meta",
    quote:
      "The match score feature helped me prioritize where to focus. I knew exactly which applications were worth my time — and landed three offers in six weeks.",
    avatar: "/user-avatars/ihssan-rami-azouagh-gKzxWyJmKLQ-unsplash.jpg",
    highlight: "3 offers in 6 weeks",
    featured: true,
  },
  {
    name: "Sarah Chen",
    role: "Software Engineer at Google",
    quote:
      "Aven completely transformed how I tracked my job search. I applied to 40+ jobs and never lost track of a single one.",
    avatar: "/user-avatars/alex-suprun-mynsNaNwVDc-unsplash.jpg",
  },
  {
    name: "Marcus Johnson",
    role: "Product Designer at Stripe",
    quote:
      "The AI email composer alone saved me hours. Every application felt personalized without the manual effort.",
    avatar: "/user-avatars/diego-hernandez-MSepzbKFz10-unsplash.jpg",
  },
];

const [featured, ...rest] = testimonials;

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="size-4 fill-primary text-primary" />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section id="testimonials" className="scroll-mt-24 px-6 py-40">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Loved by job seekers
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Join thousands who streamlined their job search and landed their
            dream roles.
          </p>
          <div className="mt-6 inline-flex items-center gap-2.5">
            <Stars />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">4.9/5</span> from
              2,000+ job seekers
            </span>
          </div>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:auto-rows-fr">
          <article className="relative flex flex-col overflow-hidden rounded-4xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card p-6 transition-all hover:shadow-xl hover:shadow-primary/5 sm:p-8 lg:col-span-2 lg:row-span-2">
            <Quote className="absolute top-6 right-6 size-16 text-primary/10" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-primary text-primary" />
              ))}
            </div>
            <p className="mt-5 flex-1 text-lg leading-relaxed font-heading sm:text-xl">
              &ldquo;{featured.quote}&rdquo;
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage src={featured.avatar} alt={featured.name} />
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{featured.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {featured.role}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-600">
                {featured.highlight}
              </span>
            </div>
          </article>

          {rest.map((t) => (
            <article
              key={t.name}
              className="flex flex-col rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={t.avatar} alt={t.name} />
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
