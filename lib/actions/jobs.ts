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
  const workLocation = formData.get("work_location") as string | null;
  const deadline = formData.get("deadline") as string | null;
  const source = formData.get("source") as string | null;
  const notesRaw = formData.get("notes") as string | null;
  const notes = notesRaw ? JSON.parse(notesRaw) : [];

  // Find or create company
  let companyId: string;

  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .eq("name", companyName)
    .single();

  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({ user_id: userId, name: companyName })
      .select("id")
      .single();

    if (companyError) {
      redirect("/applications?error=" + encodeURIComponent("Failed to save company."));
    }
    companyId = newCompany.id;
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      company_id: companyId,
      title,
      application_url: applicationUrl || null,
      location: location || null,
      salary_range: salaryRange || null,
      description: description || null,
      employment_type: employmentType || null,
      work_location: workLocation || null,
      deadline: deadline || null,
      source: source || null,
      notes: notes.length > 0 ? notes : null,
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
