"use server";

import nodemailer from "nodemailer";
import { getUser } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  resumeId: string | null;
}

export async function sendApplicationEmail(params: SendEmailParams): Promise<{ error?: string; success?: boolean }> {
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
      // Download from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("job-imports")
        .download(doc.file_path);

      if (!downloadError && fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        resumeAttachment = {
          filename: doc.name || "resume.pdf",
          content: Buffer.from(arrayBuffer),
        };
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
    return { success: true };
  } catch (err) {
    console.error("Failed to send email:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Failed to send email: ${message}` };
  }
}
