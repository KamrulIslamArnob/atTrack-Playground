"use client";

import { useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import { ChatQueueProvider } from "@/lib/ai-chatbot/chat-queue-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="attrack-theme"
    >
      <ChatQueueProvider>
        {children}
        <Toaster richColors position="bottom-right" />
      </ChatQueueProvider>
    </NextThemesProvider>
  );
}
