"use server";

import nodemailer from "nodemailer";
import { getUser } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.email");

interface SendEmailParams {
  jobId: string;
  applicationId?: string | null;
  to: string;
  subject: string;
  body: string;
  resumeId: string | null;
  resumeName?: string | null;
}

export async function sendApplicationEmail(params: SendEmailParams): Promise<{ error?: string; success?: boolean; emailId?: string }> {
  const { supabase, userId } = await getUser();

  // Fetch SMTP config
  const { data: smtpConfig } = await supabase
    .from("smtp_config")
    .select("host, port, user_email, encrypted_password")
    .eq("user_id", userId)
    .single();

  if (!smtpConfig) {
    return { error: "SMTP not configured. Please set up email in Settings." };
  }

  // Decrypt password
  let password: string;
  try {
    password = decrypt(smtpConfig.encrypted_password);
  } catch {
    return { error: "Failed to decrypt SMTP password. Please reconfigure in Settings." };
  }

  // Fetch resume attachment if provided
  let resumeAttachment: { filename: string; content: Buffer } | null = null;
  if (params.resumeId) {
    const { data: doc } = await supabase
      .from("documents")
      .select("name, file_path")
      .eq("id", params.resumeId)
      .eq("user_id", userId)
      .single();

    if (doc?.file_path) {
      if (doc.file_path.startsWith("/resume/")) {
        const localPath = path.join(process.cwd(), "public", doc.file_path);
        try {
          const fileBuffer = await readFile(localPath);
          resumeAttachment = {
            filename: doc.name.endsWith(".pdf") ? doc.name : `${doc.name}.pdf`,
            content: fileBuffer,
          };
        } catch (e) {
          log.error({ err: e }, "Failed to read local resume file for email:");
        }
      } else {
        // Download from storage fallback
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("documents")
          .download(doc.file_path);

        if (!downloadError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          resumeAttachment = {
            filename: doc.name.endsWith(".pdf") ? doc.name : `${doc.name}.pdf`,
            content: Buffer.from(arrayBuffer),
          };
        }
      }
    }
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user_email,
      pass: password,
    },
  });

  // Build email options
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${smtpConfig.user_email}" <${smtpConfig.user_email}>`,
    to: params.to,
    subject: params.subject,
    text: params.body,
    attachments: resumeAttachment
      ? [
          {
            filename: resumeAttachment.filename,
            content: resumeAttachment.content,
            contentType: "application/pdf",
          },
        ]
      : [],
  };

  try {
    await transporter.sendMail(mailOptions);

    // Update job status from 'saved' to 'preparing' if still saved
    await supabase
      .from("jobs")
      .update({ status: "preparing" })
      .eq("id", params.jobId)
      .eq("user_id", userId)
      .eq("status", "saved");

    // Ensure an application record exists for this job
    let applicationId = params.applicationId || null;

    if (!applicationId) {
      // Check if an application already exists for this job
      const { data: existingApp } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", params.jobId)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (existingApp) {
        applicationId = existingApp.id;
        // Update status to 'submitted' if it's 'draft'
        await supabase
          .from("applications")
          .update({ status: "submitted", applied_at: new Date().toISOString() })
          .eq("id", applicationId)
          .eq("user_id", userId)
          .eq("status", "draft");
      } else {
        // Create a new application record
        const { data: newApp } = await supabase
          .from("applications")
          .insert({
            user_id: userId,
            job_id: params.jobId,
            status: "submitted",
            applied_at: new Date().toISOString(),
            resume_id: params.resumeId || null,
            resume_name: params.resumeName || null,
          })
          .select("id")
          .single();

        if (newApp) {
          applicationId = newApp.id;
        }
      }
    } else {
      // Application ID provided, update status to 'submitted' if it's 'draft'
      await supabase
        .from("applications")
        .update({ status: "submitted", applied_at: new Date().toISOString() })
        .eq("id", applicationId)
        .eq("user_id", userId)
        .eq("status", "draft");
    }

    // Store email record in application_emails
    const { data: emailRecord, error: insertError } = await supabase
      .from("application_emails")
      .insert({
        user_id: userId,
        job_id: params.jobId,
        application_id: applicationId,
        recipient_email: params.to,
        from_email: smtpConfig.user_email,
        subject: params.subject,
        body: params.body,
        resume_id: params.resumeId || null,
        resume_name: params.resumeName || null,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      log.error({ err: insertError }, "Failed to store email record:");
    }

    return { success: true, emailId: emailRecord?.id };
  } catch (err) {
    log.error({ err }, "Failed to send email:");
    const message = err instanceof Error ? err.message : "Unknown error";

    // Store failed email record
    await supabase
      .from("application_emails")
      .insert({
        user_id: userId,
        job_id: params.jobId,
        application_id: params.applicationId || null,
        recipient_email: params.to,
        from_email: smtpConfig.user_email,
        subject: params.subject,
        body: params.body,
        resume_id: params.resumeId || null,
        resume_name: params.resumeName || null,
        status: "failed",
        error_message: message,
        sent_at: new Date().toISOString(),
      });

    return { error: `Failed to send email: ${message}` };
  }
}

export async function getApplicationEmails(jobId: string) {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("application_emails")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("sent_at", { ascending: false });

  if (error) {
    log.error({ err: error }, "Failed to fetch application emails:");
    return [];
  }

  return data ?? [];
}
