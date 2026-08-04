import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { LandingHeaderWrapper } from "@/components/landing-header-wrapper";
import {
  LegalShell,
  LegalSection,
  LegalParagraph,
  LegalList,
} from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms that apply when you use Aven to manage your job search.",
};

export default function TermsPage() {
  return (
    <>
      <LandingHeaderWrapper />
      <LegalShell
        badge="Terms & Conditions"
        title="Terms of service"
        subtitle="The rules that apply when you use Aven and its features."
        updated="August 4, 2026"
      >
        <LegalSection index="01" title="Acceptance of these terms">
          <LegalParagraph>
            By creating an account or using Aven in any way, you agree to these
            Terms and Conditions. If you do not agree, please do not use the
            service. These terms also reference our{" "}
            <a
              href="/privacy-policy"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              Privacy Policy
            </a>
            , which explains how your data is handled.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="02" title="The service">
          <LegalParagraph>
            Aven is a personal workspace for tracking a job search. It lets you
            save jobs, manage applications and interviews, store resumes and
            other documents, track statistics, and use AI features including
            screenshot-based job extraction, an email composer, resume matching,
            and interview practice tests.
          </LegalParagraph>
          <LegalParagraph>
            You are responsible for your own job search. Aven provides tools
            and conveniences, but applying for jobs, sending emails, and
            deciding which roles to pursue are your decisions.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="03" title="Accounts">
          <LegalParagraph>
            You need an account to use Aven. To create one you must be at least
            13 years old. You are responsible for keeping your sign-in
            credentials confidential and for everything that happens under your
            account. Please keep the information on your profile accurate.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="04" title="Your content">
          <LegalParagraph>
            You retain ownership of the content you add to Aven — your jobs,
            applications, notes, documents, and emails. You are responsible for
            the content you upload and for making sure you have the right to use
            it.
          </LegalParagraph>
          <LegalList
            items={[
              <>Only upload documents and job postings that you are entitled to use.</>,
              <>Do not upload content that contains someone else&apos;s confidential or personal information without permission.</>,
              <>You grant Aven the limited right to store, process, and display your content in order to provide the service to you.</>,
            ]}
          />
        </LegalSection>

        <LegalSection index="05" title="AI-generated content">
          <LegalParagraph>
            Aven&apos;s AI features generate content automatically: extracted job
            details, email drafts, resume match scores, and practice questions.
            This content is produced by a third-party AI provider and is not
            reviewed by humans.
          </LegalParagraph>
          <LegalParagraph>
            AI output can be inaccurate or incomplete. You are responsible for
            reviewing anything the AI generates before using it — check email
            drafts before sending, and verify extracted job details before you
            rely on them.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="06" title="Acceptable use">
          <LegalParagraph>
            You agree not to misuse Aven. Specifically, you may not:
          </LegalParagraph>
          <LegalList
            items={[
              <>Attempt to access another user&apos;s account or data.</>,
              <>Interfere with, disrupt, or overload the service or its infrastructure.</>,
              <>Scrape or bulk-harvest content or data from the service.</>,
              <>Use the service in violation of any applicable law or regulation.</>,
              <>Upload malicious files or use the service to transmit malware.</>,
            ]}
          />
        </LegalSection>

        <LegalSection index="07" title="Third-party services">
          <LegalParagraph>
            Aven relies on third-party services, including Supabase (database,
            authentication, and storage), OpenRouter (AI processing), and your
            own SMTP provider for sending emails. These services have their own
            terms and privacy practices, which apply when their services are
            used.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="08" title="Fees and payments">
          <LegalParagraph>
            Aven is currently provided free of charge. If paid features are
            introduced in the future, they will be clearly communicated and
            governed by separate terms before you are charged.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="09" title="Intellectual property">
          <LegalParagraph>
            The Aven service, including its software, design, and branding,
            belongs to Aven. Your content remains yours. Nothing in these terms
            transfers any rights to the other party beyond what is needed to
            use the service.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="10" title="Termination">
          <LegalParagraph>
            You can stop using Aven at any time and delete your account from
            Settings, which removes your data as described in our Privacy
            Policy.
          </LegalParagraph>
          <LegalParagraph>
            We may suspend or terminate access to the service if you violate
            these terms, such as by misusing the service or attempting to access
            another user&apos;s data.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="11" title="Disclaimers">
          <LegalParagraph>
            The service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, express or implied,
            including that it will be uninterrupted, error-free, or that
            AI-generated results will be accurate or complete.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="12" title="Limitation of liability">
          <LegalParagraph>
            To the maximum extent permitted by law, Aven shall not be liable
            for indirect, incidental, special, consequential, or punitive
            damages, or for any loss of data or opportunities, arising from
            your use of the service.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="13" title="Changes to these terms">
          <LegalParagraph>
            We may update these terms from time to time. We will update the
            date at the top of this page when we do. Continuing to use Aven
            after changes are posted means you accept the updated terms.
          </LegalParagraph>
        </LegalSection>
      </LegalShell>
      <Footer />
    </>
  );
}
