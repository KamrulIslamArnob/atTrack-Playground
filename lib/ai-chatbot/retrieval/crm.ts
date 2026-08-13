import { getContacts } from "@/lib/actions/contacts";
import type { RetrievedDoc } from "./types";

const CONTACT_CAP = 20;

/** CRM contacts for crm_lookup / outreach intents. */
export async function getContactsRetrieved(userId: string): Promise<RetrievedDoc[]> {
  const contacts = await getContacts().catch(() => []);
  const out: RetrievedDoc[] = [];

  contacts.slice(0, CONTACT_CAP).forEach((c) => {
    const socials = [c.linkedin_url, c.github_url, c.social_links]
      .filter(Boolean)
      .join("; ");
    const text = [
      `Name: ${c.name}`,
      c.role ? `Role: ${c.role}` : null,
      c.position ? `Position: ${c.position}` : null,
      c.company_name ? `Company: ${c.company_name}` : null,
      c.email ? `Email: ${c.email}` : null,
      socials ? `Socials: ${socials}` : null,
      c.notes ? `Notes: ${c.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    out.push({
      source: "crm",
      id: `contact:${c.id}`,
      title: c.name,
      text,
      citeRef: `contact:${c.id}`,
    });
  });
  void userId;
  return out;
}
