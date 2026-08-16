import { getDb } from "@/lib/db/sqlite";
import { getOrCreateLocalUser } from "@/lib/db/local-user";

export function seedSchemaMemory() {
  const userId = getOrCreateLocalUser().id;
  const db = getDb();
  const title = "Canonical Database Schema & Entity Guide";
  const existing = db.prepare("SELECT id FROM ai_memories WHERE user_id = ? AND title = ?").get(userId, title) as { id: string } | undefined;

  const content = `# Database Schema & Entity Guide

## Core Tables & Column Mappings
- **jobs**: Represents tracked job applications. Columns:
  - \`id\` (UUID TEXT PK)
  - \`title\` (Job title string, required)
  - \`company_id\` (FK to companies.id)
  - \`list_id\` (FK to board_lists.id - sets the board column)
  - \`state\` ('active' | 'on_hold' | 'archived')
  - \`deadline\` (ISO-8601 string or date)
  - \`salary_range\`, \`location\`, \`description\`, \`application_url\`
  - Note: \`status\` is automatically computed from \`list_id\` (do not write directly).

- **companies**: Workspace companies. Columns:
  - \`id\` (UUID TEXT PK), \`name\` (string, required), \`website\`, \`location\`, \`company_type\`, \`founded_year\`, \`country\`

- **board_lists**: Kanban columns on the board. Columns:
  - \`id\` (UUID TEXT PK), \`name\` (string), \`kind\` ('wishlist' | 'preparing' | 'applied' | 'interview' | 'offer' | 'accepted' | 'rejected' | 'custom'), \`sort_order\` (number)

- **contacts**: Networking and recruiter contacts. Columns:
  - \`id\` (UUID TEXT PK), \`name\`, \`position\`, \`company_name\`, \`email\`, \`phone\`, \`role\`, \`notes\`, \`social_links\` (JSON)

- **documents**: Resumes and cover letters. Columns:
  - \`id\` (UUID TEXT PK), \`name\`, \`type\` ('resume' | 'cover_letter' | 'other'), \`content\` (Markdown/text), \`is_default\` (0 or 1)

- **links**: Resource directory links. Columns:
  - \`id\` (UUID TEXT PK), \`title\`, \`url\`, \`category_id\` (FK to link_categories.id), \`description\`

## Tool Operations
- Use \`write_database\` with \`action: 'insert'\` or \`action: 'update'\` to create/modify records.
- \`write_database\` automatically handles company name creation and board stage name resolution for jobs.
- Never output fake raw SQL blocks asking the user to approve manually. Call the tool directly.`;

  const now = new Date().toISOString();
  if (existing) {
    db.prepare("UPDATE ai_memories SET description = ?, updated_at = ? WHERE id = ?").run(content, now, existing.id);
    console.log("Updated existing AI memory guide.");
  } else {
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO ai_memories (id, user_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, userId, title, content, now, now);
    console.log("Seeded AI memory schema guide.");
  }
}

seedSchemaMemory();
