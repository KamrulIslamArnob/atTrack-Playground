"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ToastHandler() {
  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("toast="));

    if (cookie) {
      try {
        const data = JSON.parse(decodeURIComponent(cookie.split("=")[1]));
        if (data.type === "error") {
          toast.error(data.message);
        } else {
          toast.success(data.message);
        }
      } catch {}
      document.cookie = "toast=; path=/; max-age=0";
    }
  }, []);

  return null;
}
