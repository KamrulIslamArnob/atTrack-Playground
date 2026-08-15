import { getUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSmtpConfig } from "@/lib/actions/smtp";
import { listProviders, getTaskRoutes } from "@/lib/actions/ai-providers";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { ProfileForm, type Profile } from "@/components/settings/profile-form";
import { DeleteAccount } from "@/components/settings/delete-account";
import { AiProvidersSettings } from "@/components/settings/ai-providers-settings";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Mail, Sparkles } from "lucide-react";

import { UpdateChecker } from "@/components/settings/update-checker";
import { ExtensionSettings } from "@/components/settings/extension-settings";
import { getExtensionSecret } from "@/lib/actions/extension";

export default async function SettingsPage() {
  const { supabase, userId, user } = await getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const smtpConfig = await getSmtpConfig();
  const [aiProviders, aiTaskRoutes, extensionSecret] = await Promise.all([
    listProviders(),
    getTaskRoutes(),
    getExtensionSecret(),
  ]);

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Your profile, your email settings, your data.
            </p>
        </div>
      </div>

      <Breadcrumbs />

      <UpdateChecker />

      <ExtensionSettings secret={extensionSecret} />

      <Card>
        <CardContent className="pt-0">
          <AvatarUpload
            avatarUrl={profile?.avatar_url}
            fullName={profile?.full_name}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={{ ...(profile || {}), email: user.email } as unknown as Profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Mail className="size-4" />
            Email (SMTP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SmtpConfigCard config={smtpConfig} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="size-4" />
            AI Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AiProvidersSettings initialProviders={aiProviders} initialRoutes={aiTaskRoutes} />
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete all data</p>
              <p className="text-xs text-muted-foreground">
                Permanently remove every job, application, document, and file
                from this machine.
              </p>
            </div>
            <DeleteAccount confirmPhrase={profile?.full_name || "DELETE"} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SmtpConfigCard({ config }: { config: Awaited<ReturnType<typeof getSmtpConfig>> }) {
  return <SmtpConfigFormWrapper config={config} />;
}

import { SmtpConfigFormWrapper } from "@/components/settings/smtp-config-form-wrapper";
