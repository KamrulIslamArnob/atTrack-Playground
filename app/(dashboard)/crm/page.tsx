import { Breadcrumbs } from "@/components/breadcrumbs";
import { CrmView } from "@/components/crm/crm-view";
import { getCrmCompanies } from "@/lib/actions/companies";
import { getContacts } from "@/lib/actions/contacts";

export const metadata = { title: "CRM" };

export default async function CrmPage() {
  const [companies, contacts] = await Promise.all([getCrmCompanies(), getContacts()]);

  return (
    <div className="space-y-4">
      <div className="-mx-6 border-b border-border pb-4">
        <div className="px-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">CRM</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              The people and companies in your job search. Recruiters, hiring managers, referrals — everyone you&apos;re talking to.
            </p>
        </div>
      </div>

      <Breadcrumbs />

      <CrmView companies={companies} contacts={contacts} />
    </div>
  );
}
