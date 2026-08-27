"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import { ChatQueueProvider } from "@/lib/ai-chatbot/chat-queue-context";
import { AITaskQueueProvider } from "@/lib/ai-tasks/task-queue-context";
import { TaskQueuePanel } from "@/components/ai-tasks/task-queue-panel";
import { SmoothScrollEnhancer } from "@/components/ui/smooth-scroll-enhancer";

// Suppress React 19 warning from next-themes inline script tag (script inside React tree)
// next-themes injects a <script dangerouslySetInnerHTML> for FOUC prevention; React 19 now warns
// "Encountered a script tag while rendering". The script is safe — silence the specific warning.
if (typeof window !== "undefined") {
  const origError = console.error.bind(console);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (console as any).error = (...args: any[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.includes("Encountered a script tag") || first.includes("Scripts inside React components")) {
      return;
    }
    origError(...args);
  };
}

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

