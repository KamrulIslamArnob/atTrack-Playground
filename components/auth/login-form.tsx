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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required disabled={pending} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner className="mr-2" /> : null}
        Sign in
      </Button>
    </form>
  );
}
