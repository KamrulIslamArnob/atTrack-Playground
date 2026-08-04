"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What does Aven do?",
    answer:
      "Aven is a private workspace that brings your entire job search into one place. Track jobs, applications, and interviews, generate tailored emails, and practice with AI — from the moment you discover a role to the day you accept the offer.",
  },
  {
    question: "How does the AI screenshot import work?",
    answer:
      "Paste a screenshot of a job posting — or several — and our AI extracts the title, company, salary, location, requirements, employment type, and how to apply. Everything is structured and saved in seconds, no copy-pasting required.",
  },
  {
    question: "How does the AI email composer work?",
    answer:
      "Aven drafts a personalized application email tailored to the role and your experience. You can edit and preview it, attach your resume, and send it directly through your own SMTP account — Gmail, Outlook, or any provider.",
  },
  {
    question: "What is the resume match score?",
    answer:
      "AI compares your resume against each job description and returns a percentage match score with a short explanation. Use it to prioritize the roles where you're strongest before you apply.",
  },
  {
    question: "Can I practice for interviews with Aven?",
    answer:
      "Yes. Aven generates role-specific multiple-choice questions based on the job, shows which questions you missed, and tracks your scores over time so you can study where it matters most.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Completely. Aven is a private workspace, not a job board. Your applications, resumes, and interview notes are encrypted and never shared with third parties — you own your data.",
  },
  {
    question: "Is Aven really free?",
    answer:
      "Yes. Aven is completely free — unlimited job tracking, AI screenshot import, the AI email composer, resume matching, the interview tracker, and MCQ practice tests are all included. No credit card required.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 px-6 py-40">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
            Straight answers to the questions job seekers ask most.
          </p>
        </div>

        <Accordion
          defaultValue={[faqs[0].question]}
          className="mt-16 rounded-4xl border-border bg-gradient-to-br from-primary/[0.06] via-card to-card"
        >
          {faqs.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger className="hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
