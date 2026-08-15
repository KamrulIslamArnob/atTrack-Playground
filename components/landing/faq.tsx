"use client";

import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal, staggerContainer, staggerItem } from "@/components/landing/motion";

const faqs = [
  {
    question: "What does atTrack do?",
    answer:
      "atTrack is a private workspace for your job search. You save jobs, track applications and interviews, draft application emails with AI, and practice for interviews — all in one place. It runs on your own machine, not in someone else's cloud.",
  },
  {
    question: "How does the screenshot import work?",
    answer:
      "You screenshot a job posting and paste it into atTrack. The AI reads the image and fills in the title, company, salary, location, and requirements. You can review and edit before saving.",
  },
  {
    question: "How does the application email feature work?",
    answer:
      "atTrack drafts an email using the job details and your resume. You edit it, attach your resume if you want, and send it through your own email account — Gmail, Outlook, or any provider you set up in Settings.",
  },
  {
    question: "What's the resume match score?",
    answer:
      "atTrack compares your resume against a job description and gives you a percentage score with a short explanation. It helps you focus on the roles where you're a strong fit.",
  },
  {
    question: "Can I practice for interviews?",
    answer:
      "Yes. atTrack generates multiple-choice questions based on a specific job. You take the test, see what you got wrong, and track your scores over time.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. atTrack runs entirely on your machine. Your jobs, applications, resumes, and notes live in a local database — not on a server somewhere. Nothing is shared with third parties.",
  },
  {
    question: "Is atTrack free?",
    answer:
      "Yes, completely. Job tracking, screenshot import, email drafts, resume scoring, interview tracking, and practice tests are all included. There's no account, no subscription, and no credit card required.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 px-6 py-40">
      <div className="mx-auto max-w-4xl">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
            The things people usually want to know before they start.
          </p>
        </Reveal>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px", amount: 0.1 }}
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem}>
            <Accordion
              defaultValue={[faqs[0].question]}
              className="mt-16 rounded-2xl border-border bg-gradient-to-br from-primary/[0.06] via-card to-card"
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
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
