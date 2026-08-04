"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "Is Aven free to use?",
    answer: "Yes! Aven's free tier includes unlimited job tracking, AI screenshot import, AI email composer, resume matching, interview tracker, and MCQ practice tests. No credit card required.",
  },
  {
    question: "How does the AI screenshot import work?",
    answer: "Simply paste a screenshot (or multiple screenshots) of a job posting. Our AI extracts the title, company, salary, location, requirements, employment type, and how to apply — all structured in seconds.",
  },
  {
    question: "Is my data private and secure?",
    answer: "Absolutely. Aven is a private workspace, not a job board. Your applications, resumes, and interview notes are encrypted and never shared with third parties. You own your data.",
  },
  {
    question: "Can I send application emails through Aven?",
    answer: "Yes. Configure your SMTP settings (Gmail, Outlook, or any provider) and Aven will send personalized, AI-generated application emails on your behalf with your resume attached.",
  },
  {
    question: "What is the resume match score?",
    answer: "AI compares your resume against each job description and gives you a percentage match score. This helps you prioritize which jobs to apply to and tailor your resume for better chances.",
  },
  {
    question: "Can I import jobs from URLs?",
    answer: "Yes. In addition to screenshots, you can paste job posting URLs and Aven will fetch and extract the details automatically.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Everything you need to know about Aven.
          </p>
        </div>

        <div className="mt-16 space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-4xl border border-border bg-card"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium"
              >
                {faq.question}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    openIndex === i && "rotate-180",
                  )}
                />
              </button>
              {openIndex === i && (
                <div className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
