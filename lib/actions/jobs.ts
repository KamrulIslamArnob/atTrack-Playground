"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";

export async function createJob(formData: FormData) {
  const { supabase, userId } = await getUser();

  const title = formData.get("title") as string;
  const companyName = formData.get("company") as string;
  const applicationUrl = formData.get("application_url") as string | null;
  const location = formData.get("location") as string | null;
  const salaryRange = formData.get("salary_range") as string | null;
  const description = formData.get("description") as string | null;
  const employmentType = formData.get("employment_type") as string | null;
  const deadline = formData.get("deadline") as string | null;
  const source = formData.get("source") as string | null;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .upsert({ user_id: userId, name: companyName }, { onConflict: "user_id,name" })
    .select("id")
    .single();

  if (companyError) {
    redirect("/applications?error=" + encodeURIComponent("Failed to save company."));
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      company_id: company.id,
      title,
      application_url: applicationUrl || null,
      location: location || null,
      salary_range: salaryRange || null,
      description: description || null,
      employment_type: employmentType || null,
      deadline: deadline || null,
      source: source || null,
    })
    .select("id")
    .single();

  if (jobError) {
    redirect("/applications?error=" + encodeURIComponent("Failed to save job."));
  }

  const { error: appError } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      job_id: job.id,
      status: "draft",
    });

  if (appError) {
    redirect("/applications?error=" + encodeURIComponent("Failed to create application."));
  }

  revalidatePath("/applications");
  redirect("/applications/" + job.id);
}
