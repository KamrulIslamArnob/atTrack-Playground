import { LandingHeader } from "@/components/landing-header";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { AiHighlight } from "@/components/landing/ai-highlight";
import { Testimonials } from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { Privacy } from "@/components/landing/privacy";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <AiHighlight />
        <Testimonials />
        <Faq />
        <Privacy />
        <Cta />
      </main>

      <Footer />
    </div>
  );
}
