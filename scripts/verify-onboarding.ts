import { getDb } from "../lib/db/sqlite.ts";
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { seedSampleJobsAndContacts, deleteSampleData, hasDemoData } from "../lib/db/seed-demo.ts";
import { completeOnboarding, getOnboardingStatus, skipOnboarding, resetOnboarding } from "../lib/actions/onboarding.ts";

async function main() {
  console.log("=== Testing Onboarding & Seed Subsystem ===");
  const user = getOrCreateLocalUser();
  console.log(`Local user ID: ${user.id}`);

  // Initial cleanup to guarantee test isolation
  deleteSampleData(user.id);

  // Test 1: Seed Demo Data
  console.log("\n[Test 1] Seeding demo jobs & contacts...");
  const seedResult = seedSampleJobsAndContacts({ userId: user.id });
  console.log(`Seeded ${seedResult.jobIds.length} jobs, ${seedResult.companyIds.length} companies, ${seedResult.contactIds.length} contacts.`);
  if (seedResult.jobIds.length !== 3) throw new Error("Expected 3 jobs seeded");

  const hasDemo = hasDemoData(user.id);
  console.log(`hasDemoData: ${hasDemo}`);
  if (!hasDemo) throw new Error("Expected hasDemoData to be true");

  // Test 2: Clean Demo Data
  console.log("\n[Test 2] Cleaning demo data...");
  const deleteResult = deleteSampleData(user.id);
  console.log(`Removed ${deleteResult.removedCount} demo jobs.`);
  if (deleteResult.removedCount !== 3) throw new Error("Expected 3 jobs removed");

  const hasDemoAfter = hasDemoData(user.id);
  console.log(`hasDemoData after deletion: ${hasDemoAfter}`);
  if (hasDemoAfter) throw new Error("Expected hasDemoData to be false after cleanup");

  // Test 3: Complete Onboarding Action
  console.log("\n[Test 3] Testing completeOnboarding Action...");
  const onboardRes = await completeOnboarding({
    fullName: "Kamrul Islam",
    targetRole: "Staff Platform Architect",
    experienceLevel: "senior",
    resumeText: "Experienced Software Architect with 10+ years in distributed systems, TypeScript, Next.js, and SQLite.",
    resumeFileName: "Kamrul_Resume.pdf",
    seedDemoData: true,
  });

  console.log("completeOnboarding result:", onboardRes);
  if (!onboardRes.success) throw new Error("Expected completeOnboarding to succeed");

  const status = await getOnboardingStatus();
  console.log("Onboarding Status:", status);
  if (!status.isOnboarded) throw new Error("Expected user to be marked onboarded");
  if (status.primaryPositionName !== "Staff Platform Architect") throw new Error("Target role mismatch");
  if (!status.hasResume) throw new Error("Expected hasResume to be true");
  if (!status.hasDemoData) throw new Error("Expected hasDemoData to be true");

  console.log("\n All Onboarding & Seed tests PASSED!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
