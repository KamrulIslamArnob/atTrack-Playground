import { getUser } from "@/lib/auth";
import { getSmtpConfig } from "@/lib/actions/smtp";
import { listProviders, getTaskRoutes } from "@/lib/actions/ai-providers";
import { getExtensionSecret } from "@/lib/actions/extension";
import { getGithubSyncStatus } from "@/lib/actions/gist-sync";
import { getCloudSyncStatus } from "@/lib/actions/cloud-sync";
import { getLicenseState } from "@/lib/actions/license";
import { PageHeader } from "@/components/page-header";
import { SettingsTabView } from "@/components/settings/settings-tab-view";
import type { Profile } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const { supabase, userId, user } = await getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const smtpConfig = await getSmtpConfig();
  const [aiProviders, aiTaskRoutes, extensionSecret, githubSyncStatus, cloudSyncStatus, licenseState] = await Promise.all([
    listProviders(),
    getTaskRoutes(),
    getExtensionSecret(),
    getGithubSyncStatus(),
    getCloudSyncStatus(),
    getLicenseState(),
  ]);

  const userProfile = {
    ...(profile || {}),
    email: user?.email ?? profile?.email,
  } as unknown as Profile;

  return (
    <div className="space-y-6 pb-16">
      <PageHeader title="Settings" />

      <SettingsTabView
        profile={userProfile}
        avatarUrl={profile?.avatar_url}
        fullName={profile?.full_name}
        showRawDatabase={Boolean(profile?.show_raw_database)}
        smtpConfig={smtpConfig}
        aiProviders={aiProviders}
        aiTaskRoutes={aiTaskRoutes}
        extensionSecret={extensionSecret}
        githubSyncStatus={githubSyncStatus}
        cloudSyncStatus={cloudSyncStatus}
        licenseState={licenseState}
      />
    </div>
  );
}
