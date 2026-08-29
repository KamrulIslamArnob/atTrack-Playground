import { getDb } from "../lib/db/sqlite.ts";
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { seedSampleJobsAndContacts, deleteSampleData, hasDemoData } from "../lib/db/seed-demo.ts";

async function main() {
  console.log("=== Testing Expanded Showcase Seed Suite ===");
  const user = getOrCreateLocalUser();
  console.log(`Local user ID: ${user.id}`);

  // Test 1: Seed Expanded Demo Data
  console.log("\n[Test 1] Seeding rich demo dataset...");
  const seedResult = seedSampleJobsAndContacts({ userId: user.id });
  console.log(`Seeded ${seedResult.jobIds.length} jobs, ${seedResult.companyIds.length} companies, ${seedResult.contactIds.length} contacts.`);

  const db = getDb();
  const jobCount = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE user_id = ?").get(user.id) as { count: number }).count;
  const companyCount = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE user_id = ?").get(user.id) as { count: number }).count;
  const contactCount = (db.prepare("SELECT COUNT(*) as count FROM contacts WHERE user_id = ?").get(user.id) as { count: number }).count;
  const interviewCount = (db.prepare("SELECT COUNT(*) as count FROM interviews WHERE user_id = ?").get(user.id) as { count: number }).count;
  const linkCount = (db.prepare("SELECT COUNT(*) as count FROM links WHERE user_id = ?").get(user.id) as { count: number }).count;
  const shortcutCount = (db.prepare("SELECT COUNT(*) as count FROM quick_shortcuts WHERE user_id = ?").get(user.id) as { count: number }).count;

  console.log(`Total Database Stats for user:
- Jobs: ${jobCount}
- Companies: ${companyCount}
- Contacts: ${contactCount}
- Interviews: ${interviewCount}
- Resource Links: ${linkCount}
- Quick Shortcuts: ${shortcutCount}
`);

  if (jobCount < 15) throw new Error(`Expected at least 15 jobs, got ${jobCount}`);
  if (companyCount < 15) throw new Error(`Expected at least 15 companies, got ${companyCount}`);
  if (contactCount < 15) throw new Error(`Expected at least 15 contacts, got ${contactCount}`);

  const hasDemo = hasDemoData(user.id);
  console.log(`hasDemoData: ${hasDemo}`);
  if (!hasDemo) throw new Error("Expected hasDemoData to be true");

  // Test 2: Clean Demo Data
  console.log("\n[Test 2] Testing 1-click Delete Demo Data...");
  const deleteResult = deleteSampleData(user.id);
  console.log(`Removed ${deleteResult.removedCount} demo jobs.`);

  const hasDemoAfter = hasDemoData(user.id);
  console.log(`hasDemoData after deletion: ${hasDemoAfter}`);
  if (hasDemoAfter) throw new Error("Expected hasDemoData to be false after cleanup");

  // Test 3: Re-seed to leave database populated with showcase data
  console.log("\n[Test 3] Re-seeding rich showcase data for production use...");
  const reseed = seedSampleJobsAndContacts({ userId: user.id });
  console.log(`Successfully re-seeded ${reseed.jobIds.length} jobs, ${reseed.companyIds.length} companies, ${reseed.contactIds.length} contacts.`);

  console.log("\n All Showcase Seed Suite tests PASSED successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
