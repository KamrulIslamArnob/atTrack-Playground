import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import {
  LegalShell,
  LegalSection,
  LegalParagraph,
  LegalList,
  LegalNote,
} from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Aven collects, uses, and protects your information while tracking your job search.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <LegalShell
        badge="Privacy Policy"
        title="Your data stays yours"
        subtitle="How Aven collects, uses, and protects your information — explained in plain language."
        updated="August 4, 2026"
      >
        <LegalSection index="01" title="Overview">
          <LegalParagraph>
            Aven is a personal workspace for tracking your job search. You use
            it to save jobs, manage applications and interviews, upload
            documents, and use AI features that help you draft emails, match
            your resume, and practice for interviews.
          </LegalParagraph>
          <LegalParagraph>
            This policy explains what information we collect, why we collect
            it, and the choices you have. By creating an account or using Aven,
            you agree to the practices described here.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="02" title="Information we collect">
          <LegalParagraph>
            <strong>Account information.</strong> When you sign up, we collect
            your email address and a password. Passwords are handled by our
            authentication provider, Supabase Auth, which stores them as secure
            hashes. You may also add a full name, headline, phone number,
            location, and website to your profile, and upload an avatar image.
            You can sign in with email and password, with your Google account,
            or with a one-time magic link sent to your email.
          </LegalParagraph>
          <LegalParagraph>
            <strong>Job search data.</strong> Everything you save while using
            the app, including companies, jobs (title, description, URL,
            location, salary range, employment type, work location, status,
            notes, deadline, and application details), applications,
            interviews, and timeline notes.
          </LegalParagraph>
          <LegalParagraph>
            <strong>Files you upload.</strong> Resumes, cover letters, and
            other documents (PDF), job-posting screenshots used for AI
            extraction, and profile avatars. These are stored in our storage
            provider (Supabase Storage).
          </LegalParagraph>
          <LegalParagraph>
            <strong>Email configuration.</strong> If you connect an email
            account to send applications, we store the SMTP host, port, sender
            email address, and your SMTP password. Your password is encrypted
            at rest with AES-256-GCM and is decrypted only at the moment it is
            needed to send an email.
          </LegalParagraph>
          <LegalParagraph>
            <strong>Sent-email records.</strong> When you send an application,
            we store a record containing the recipient, sender, subject, body,
            attached resume, and timestamp so you can track it from your
            workspace.
          </LegalParagraph>
          <LegalParagraph>
            <strong>AI activity.</strong> The inputs you provide to AI features
            (for example job screenshots, job descriptions, and resume content)
            and the results they produce, plus your practice-test scores and
            extraction logs.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="03" title="How we use your information">
          <LegalParagraph>We use your information to:</LegalParagraph>
          <LegalList
            items={[
              <>Provide and display the service — your jobs, applications, interviews, documents, and insights.</>,
              <>Power AI features — extracting structured job data from screenshots, drafting application emails, computing resume match scores, and generating practice questions.</>,
              <>Send your application emails through your own SMTP account.</>,
              <>Manage your account — sign-in, profile updates, and account deletion.</>,
              <>Keep the service secure and working, and fix issues when they arise.</>,
            ]}
          />
          <LegalParagraph>
            We do not sell your personal data, we do not run ads, and we do not
            share your data with third parties for their own marketing purposes.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="04" title="AI features and automated processing">
          <LegalParagraph>
            Aven&apos;s AI features — screenshot import, the email composer,
            resume matching, and practice tests — work by sending your input to
            a third-party AI provider (OpenRouter, which routes requests to
            large language models) so it can generate a result.
          </LegalParagraph>
          <LegalList
            items={[
              <>
                <strong>Screenshot import:</strong> your screenshots are sent to the AI provider to extract job details such as title, company, salary, location, requirements, and how to apply.
              </>,
              <>
                <strong>Email composer:</strong> the job title and description, your name and headline, and (when you choose a resume) its text are sent to generate a draft you can review.
              </>,
              <>
                <strong>Resume matching:</strong> the job description and your resume text are compared to produce a match score and short reasoning.
              </>,
              <>
                <strong>Practice tests:</strong> the job title, description, and requirements are used to generate multiple-choice questions.
              </>,
            ]}
          />
          <LegalParagraph>
            Your content is used only to fulfill the AI request you make. We do
            not use your content to advertise to you or to others, and we do
            not resell it. AI-generated output is not human-reviewed and may
            contain errors — always review it before you send an email or rely
            on a result.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="05" title="Third-party services">
          <LegalParagraph>
            Aven relies on a small number of service providers to run the app:
          </LegalParagraph>
          <LegalList
            items={[
              <>
                <strong>Supabase</strong> hosts our database, authentication, and file storage. All database tables use row-level security so each account can only access its own data.
              </>,
              <>
                <strong>OpenRouter</strong> (and the model providers it routes to, including NVIDIA-hosted models) processes the inputs you send to AI features.
              </>,
              <>
                <strong>Your SMTP provider</strong> (for example Gmail) sends the application emails you compose. Emails are relayed using the credentials you provide.
              </>,
              <>
                <strong>Google Fonts</strong> serves the typefaces used on the site.
              </>,
              <>
                <strong>Google Calendar</strong> — interviews include a link that opens a pre-filled calendar event in your own Google Calendar. No event is created without your action.
              </>,
            ]}
          />
        </LegalSection>

        <LegalSection index="06" title="How we protect your data">
          <LegalList
            items={[
              <>
                <strong>Row-level security:</strong> every table in our database is protected so that data is only ever visible to the account that owns it.
              </>,
              <>
                <strong>Encryption:</strong> your SMTP password is encrypted at rest with AES-256-GCM. Data in transit is protected with HTTPS.
              </>,
              <>
                <strong>Server-side access control:</strong> pages and actions that need your account verify your session on the server before returning or changing data.
              </>,
            ]}
          />
        </LegalSection>

        <LegalSection index="07" title="Data retention">
          <LegalParagraph>
            We keep your data for as long as your account is active, so it is
            available when you return to the app. When you delete your account,
            your data is removed (see below).
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="08" title="Your choices and controls">
          <LegalParagraph>
            You control your data. From within the app you can:
          </LegalParagraph>
          <LegalList
            items={[
              <>Edit your profile information at any time.</>,
              <>Delete individual records, including jobs, applications, interviews, and documents.</>,
              <>Remove uploaded documents, avatars, and saved screenshots.</>,
              <>Delete your account from Settings.</>,
            ]}
          />
          <LegalNote>
            <strong>Account deletion.</strong> To delete your account you must
            confirm by typing the email address on your account. Aven then
            permanently removes your profile, jobs, applications, interviews,
            documents, practice results, email configuration, extraction logs,
            and uploaded files (including your avatar, resumes, and job
            screenshots), and closes your authentication account. This action
            cannot be undone.
          </LegalNote>
        </LegalSection>

        <LegalSection index="09" title="Cookies and local storage">
          <LegalParagraph>
            Aven uses a session cookie to keep you signed in (set by Supabase
            Auth) and stores your theme preference in your browser&apos;s local
            storage. We do not use advertising or cross-site tracking cookies.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="10" title="Children's privacy">
          <LegalParagraph>
            Aven is not directed to children under the age of 13, and we do not
            knowingly collect personal information from children. If you believe
            a child has provided us with personal information, please contact
            us so we can remove it.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="11" title="Changes to this policy">
          <LegalParagraph>
            We may update this policy from time to time. If we make material
            changes, we will update the date at the top of this page. We
            encourage you to review this page occasionally so you stay informed
            about how your information is handled.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="12" title="Contact">
          <LegalParagraph>
            If you have questions about this policy or about your data, you can
            reach the Aven team by email at{" "}
            <a
              href="mailto:support@aven.app"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              support@aven.app
            </a>
            .
          </LegalParagraph>
        </LegalSection>
      </LegalShell>
      <Footer />
    </>
  );
}
