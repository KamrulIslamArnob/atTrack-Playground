import { PageHeader } from "@/components/page-header";
import { CrmView } from "@/components/crm/crm-view";
import { getCrmCompanies, type CrmCompany } from "@/lib/actions/companies";
import { getContacts, type Contact } from "@/lib/actions/contacts";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("network");

export const metadata = { title: "Network | BetterJob" };

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
    log.error({ err }, "Failed to fetch network data");
  }

  return (
    <div className="space-y-4 pb-16">
      <PageHeader title="Network" />

      <CrmView companies={companies} contacts={contacts} />
    </div>
  );
}
