import { PageHeader } from "@/components/page-header";
import { CrmView } from "@/components/crm/crm-view";
import { getCrmCompanies, type CrmCompany } from "@/lib/actions/companies";
import { getContacts, type Contact } from "@/lib/actions/contacts";

export const metadata = { title: "Network | atTrack" };

export default async function NetworkPage() {
  let companies: CrmCompany[] = [];
  let contacts: Contact[] = [];

  try {
    const [compRes, contRes] = await Promise.all([
      getCrmCompanies().catch(() => []),
      getContacts().catch(() => []),
    ]);
    companies = compRes ?? [];
    contacts = contRes ?? [];
  } catch (err) {
    console.error("[NetworkPage] Failed to fetch data:", err);
  }

  return (
    <div className="space-y-4 pb-16">
      <PageHeader
        title="Network"
        subtitle="The people and companies in your job search. Recruiters, hiring managers, referrals — everyone you're talking to."
      />

      <CrmView companies={companies} contacts={contacts} />
    </div>
  );
}
