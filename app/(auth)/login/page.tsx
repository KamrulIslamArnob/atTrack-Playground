import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function LoginPage() {
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
          <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-3">
          <GoogleSignInButton />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <LoginForm />

          <Link
            href="/magic-link"
            className="inline-flex w-full items-center justify-center rounded-4xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
          >
            Sign in with magic link
          </Link>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
