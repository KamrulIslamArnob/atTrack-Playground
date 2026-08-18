"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import { ChatQueueProvider } from "@/lib/ai-chatbot/chat-queue-context";
import { AITaskQueueProvider } from "@/lib/ai-tasks/task-queue-context";
import { TaskQueuePanel } from "@/components/ai-tasks/task-queue-panel";
import { SmoothScrollEnhancer } from "@/components/ui/smooth-scroll-enhancer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="attrack-theme"
    >
      <AITaskQueueProvider>
        <ChatQueueProvider>
          <SmoothScrollEnhancer />
          {children}
          <TaskQueuePanel />
          <Toaster richColors position="bottom-right" />
        </ChatQueueProvider>
      </AITaskQueueProvider>
    </NextThemesProvider>
  );
}

