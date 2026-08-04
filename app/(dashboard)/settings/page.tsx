import { getUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "@/lib/actions/auth";
import { getSmtpConfig } from "@/lib/actions/smtp";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { ProfileForm } from "@/components/settings/profile-form";
import { DeleteAccount } from "@/components/settings/delete-account";
import { SmtpConfigForm } from "@/components/settings/smtp-config-form";
import { AppPasswordGuide } from "@/components/settings/app-password-guide";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LogOut, Mail } from "lucide-react";

export default async function SettingsPage() {
  const { supabase, userId, user } = await getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const smtpConfig = await getSmtpConfig();

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage your account and preferences.
          </p>
        </div>
      </div>

      <Breadcrumbs />

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
          <ProfileForm profile={profile} />
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
          <CardTitle className="text-base font-semibold">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <DeleteAccount email={user.email || ""} />
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
