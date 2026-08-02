"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function ToastHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    if (error) {
      toast.error(error);
      router.replace(window.location.pathname);
    } else if (message) {
      toast.success(message);
      router.replace(window.location.pathname);
    }
  }, [searchParams, router]);

  return null;
}
