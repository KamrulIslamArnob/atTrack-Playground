"use client";

import { FC } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/thread";

export interface AssistantProps {
  api?: string;
  className?: string;
}

export const Assistant: FC<AssistantProps> = ({
  api = "/api/chat",
  className,
}) => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api,
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={className ?? "h-full w-full"}>
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};

export default Assistant;
