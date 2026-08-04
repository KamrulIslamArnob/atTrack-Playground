import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Software Engineer at Google",
    quote: "Aven completely transformed how I tracked my job search. I applied to 40+ jobs and never lost track of a single one.",
    avatar: "/user-avatars/alex-suprun-mynsNaNwVDc-unsplash.jpg",
  },
  {
    name: "Marcus Johnson",
    role: "Product Designer at Stripe",
    quote: "The AI email composer alone saved me hours. Every application felt personalized without the manual effort.",
    avatar: "/user-avatars/diego-hernandez-MSepzbKFz10-unsplash.jpg",
  },
  {
    name: "Priya Sharma",
    role: "Data Scientist at Meta",
    quote: "The match score feature helped me prioritize where to focus. Landed 3 offers in 6 weeks.",
    avatar: "/user-avatars/ihssan-rami-azouagh-gKzxWyJmKLQ-unsplash.jpg",
  },
];

export function Testimonials() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Loved by job seekers
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Join thousands who have streamlined their job search and landed their dream roles.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-4xl border border-border bg-card p-6"
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
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="size-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
