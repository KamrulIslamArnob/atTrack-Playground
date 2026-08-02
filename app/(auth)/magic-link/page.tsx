import Link from "next/link";
import Image from "next/image";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
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
    <Card>
      <CardHeader className="justify-items-center gap-6 text-center">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Aven"
            width={32}
            height={32}
            priority
          />
          <span className="font-heading text-lg font-medium">Aven</span>
        </div>
        <CardTitle className="text-xl">Sign in with email</CardTitle>
        <CardDescription>Enter your email to receive a login link</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="mb-4 flex items-start gap-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <MagicLinkForm />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-foreground underline underline-offset-4 hover:no-underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
