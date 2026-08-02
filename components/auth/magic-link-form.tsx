"use client";

import { useFormStatus } from "react-dom";
import { signInWithMagicLink } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function MagicLinkForm() {
  const { pending } = useFormStatus();

  return (
    <form action={signInWithMagicLink} className="space-y-4">
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
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner className="mr-2" /> : null}
        Send magic link
      </Button>
    </form>
  );
}
