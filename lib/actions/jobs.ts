"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export async function createJob(formData: FormData) {
  const { supabase, userId } = await getUser();

  const title = formData.get("title") as string;
  const companyName = formData.get("company") as string;
  const url = formData.get("url") as string | null;
  const location = formData.get("location") as string | null;
  const salary = formData.get("salary") as string | null;
  const description = formData.get("description") as string | null;

  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  if (salary) {
    const parts = salary.split("-").map((s) => parseInt(s.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      salaryMin = parts[0];
      salaryMax = parts[1];
    }
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .upsert({ user_id: userId, name: companyName }, { onConflict: "user_id,name" })
    .select("id")
    .single();

  if (companyError) {
    redirect("/applications/new?error=" + encodeURIComponent("Failed to save company."));
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      company_id: company.id,
      title,
      url: url || null,
      location: location || null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      description: description || null,
    })
    .select("id")
    .single();

  if (jobError) {
    redirect("/applications/new?error=" + encodeURIComponent("Failed to save job."));
  }

  const { error: appError } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      job_id: job.id,
      status: "draft",
    });

  if (appError) {
    redirect("/applications/new?error=" + encodeURIComponent("Failed to create application."));
  }

  redirect("/applications/" + job.id);
}
