"use client";

import { useFormStatus } from "react-dom";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm() {
  const { pending } = useFormStatus();

  return (
    <form action={signIn} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={pending}
          className="h-10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          required
          disabled={pending}
          className="h-10"
        />
      </div>
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? <Spinner className="mr-2" /> : null}
        Sign in
      </Button>
    </form>
  );
}
