import { PageHeader } from "@/components/page-header";
import { CrmView } from "@/components/crm/crm-view";
import { getCrmCompanies } from "@/lib/actions/companies";
import { getContacts } from "@/lib/actions/contacts";

export const metadata = { title: "Network | atTrack" };

export default async function NetworkPage() {
  const [companies, contacts] = await Promise.all([getCrmCompanies(), getContacts()]);

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
