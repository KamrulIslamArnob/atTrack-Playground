import Link from "next/link";
import Image from "next/image";
import { AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export default async function MagicLinkPage(props: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await props.searchParams;
  const error = params.error;
  const message = params.message;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center justify-items-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Aven"
            width={28}
            height={28}
            priority
          />
          <span className="font-heading text-xl font-semibold">Aven</span>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold">Sign in with email</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a login link
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-4xl bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="mb-4 flex items-start gap-3 rounded-4xl bg-muted p-3 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <MagicLinkForm />

        <Link
          href="/login"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-4xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
