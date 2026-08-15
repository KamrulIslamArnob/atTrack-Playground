"use client";

import { createContext, useContext } from "react";

export interface ChatCanvasContextType {
  openCanvas: (content: string, title?: string, language?: string) => void;
  closeCanvas: () => void;
  isOpen: boolean;
}

export const ChatCanvasContext = createContext<ChatCanvasContextType | null>(null);

export function useChatCanvas() {
  return useContext(ChatCanvasContext);
}
