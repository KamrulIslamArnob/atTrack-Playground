import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { LandingHeaderWrapper } from "@/components/landing-header-wrapper";
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
    "How AtTrack collects, uses, and protects your information while tracking your job search.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <LandingHeaderWrapper />
      <LegalShell
        badge="Privacy Policy"
        title="Your data stays yours"
        subtitle="How AtTrack collects, uses, and protects your information — explained in plain language."
        updated="August 4, 2026"
      >
        <LegalSection index="01" title="Overview">
          <LegalParagraph>
            AtTrack is a personal workspace for tracking your job search. You use
            it to save jobs, manage applications and interviews, upload
            documents, and use AI features that help you draft emails, match
            your resume, and practice for interviews.
          </LegalParagraph>
          <LegalParagraph>
            This policy explains what information we collect, why we collect
            it, and the choices you have. By creating an account or using AtTrack,
            you agree to the practices described here.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="02" title="Information we collect">
          <LegalParagraph>
            <strong>Profile information.</strong> AtTrack runs entirely on your
            own machine and has no accounts: there is no sign-up, no sign-in, and
            no password. You may add a full name, headline, phone number,
            location, and website to your profile, and upload an avatar image.
            All of it is stored in a database file on your computer.
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
            extraction, and profile avatars. These are written to a folder on
            your own machine and are never uploaded anywhere.
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
            AtTrack&apos;s AI features — screenshot import, the email composer,
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
            AtTrack stores everything locally and contacts outside services only
            when you use a feature that requires one:
          </LegalParagraph>
          <LegalList
            items={[
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
                <strong>Local-only storage:</strong> your database file and uploaded documents live on your own machine. They are not transmitted to us or to any hosting provider.
              </>,
              <>
                <strong>Encryption:</strong> your SMTP password is encrypted at rest with AES-256-GCM.
              </>,
              <>
                <strong>No remote access:</strong> because there is no account and no server holding your data, there is nothing for a third party to sign in to. Anyone with access to your computer, however, has access to the app and its data — protect the machine itself.
              </>,
            ]}
          />
        </LegalSection>

        <LegalSection index="07" title="Data retention">
          <LegalParagraph>
            Your data stays on your machine until you remove it. Deleting the
            app&apos;s data folder, or using &ldquo;Delete all data&rdquo; in
            Settings, removes it (see below).
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
              <>Delete all of your data from Settings.</>,
            ]}
          />
          <LegalNote>
            <strong>Deleting your data.</strong> To delete everything you must
            confirm by typing your profile name. AtTrack then permanently removes
            your jobs, applications, interviews, documents, practice results,
            email configuration, extraction logs, board lists, and uploaded files
            (including your avatar, resumes, and job screenshots). This action
            cannot be undone.
          </LegalNote>
        </LegalSection>

        <LegalSection index="09" title="Cookies and local storage">
          <LegalParagraph>
            AtTrack sets no session or authentication cookies — there is nothing
            to sign in to. Your theme preference is stored in your browser&apos;s
            local storage. We do not use advertising or cross-site tracking
            cookies.
          </LegalParagraph>
        </LegalSection>

        <LegalSection index="10" title="Children's privacy">
          <LegalParagraph>
            AtTrack is not directed to children under the age of 13, and we do not
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
      </LegalShell>
      <Footer />
    </>
  );
}
