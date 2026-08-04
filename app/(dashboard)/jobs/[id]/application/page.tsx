import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { EmailComposer } from "@/components/email-composer";

export default async function ApplicationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { supabase, userId } = await getUser();

  // Fetch job with company
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, application_email, application_process, company:companies(name)")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!job) {
    redirect("/jobs");
  }

  const companyRaw = job.company;
  const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
  const jobEmail = typeof job.application_email === "string" ? job.application_email : null;

  if (!jobEmail) {
    redirect("/jobs/" + id);
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, headline")
    .eq("id", userId)
    .single();

  // Fetch all resumes
  const { data: resumes } = await supabase
    .from("documents")
    .select("id, name, content, is_default")
    .eq("user_id", userId)
    .eq("type", "resume")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  const resumeList = (resumes ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    content: r.content,
    isDefault: r.is_default,
  }));

  // Find default resume content
  const defaultResume = resumeList.find((r) => r.isDefault) ?? resumeList[0] ?? null;

  return (
    <div className="space-y-6">
      <EmailComposer
        job={{
          id: id,
          title: (job?.title as string) || "Untitled",
          company: (company?.name as string) || "Unknown",
          description: (job?.description as string) || null,
          applicationProcess: (job?.application_process as string) || null,
          applicationEmail: jobEmail,
        }}
        applicant={{
          name: (profile?.full_name as string) || "Applicant",
          headline: (profile?.headline as string) || null,
        }}
        resumes={resumeList}
        defaultResumeId={defaultResume?.id ?? null}
      />
    </div>
  );
}
