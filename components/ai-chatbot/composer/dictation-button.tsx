"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Mic, Square, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface DictationButtonProps {
  className?: string;
  onTranscript?: (text: string) => void;
  isListeningExternal?: boolean;
  onToggleExternal?: () => void;
}

export function DictationButton({
  className,
  onTranscript,
  isListeningExternal,
  onToggleExternal,
}: DictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lang, setLang] = useState("en-US");
  const [isContinuous, setIsContinuous] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    setIsSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (onToggleExternal) {
      onToggleExternal();
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = isContinuous;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript)
        .join(" ")
        .trim();
      if (transcript && onTranscript) {
        onTranscript(transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, isContinuous, lang, onTranscript, onToggleExternal]);

  const activeListening = isListeningExternal ?? isListening;

  return (
    <div className={cn("inline-flex items-center rounded-lg hover:bg-muted/60 transition-colors", className)}>
      <button
        type="button"
        onClick={toggleListening}
        disabled={!isSupported && !onToggleExternal}
        className={cn(
          "inline-flex size-6.5 items-center justify-center rounded-l-md text-muted-foreground transition-colors cursor-pointer select-none",
          activeListening
            ? "bg-rose-500/15 text-rose-500 animate-pulse"
            : "hover:text-foreground"
        )}
        title={activeListening ? "Stop listening" : "Voice dictation"}
      >
        {activeListening ? <Square className="size-3 fill-current" /> : <Mic className="size-3.5" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="inline-flex size-5.5 items-center justify-center rounded-r-md text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          title="Dictation options"
        >
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-52">
          <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Voice Dictation
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setLang("en-US")}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <span>English (US)</span>
            {lang === "en-US" && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setLang("en-GB")}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <span>English (UK)</span>
            {lang === "en-GB" && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsContinuous((prev) => !prev)}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <div>
              <div className="font-medium">Continuous Mode</div>
              <div className="text-[10px] text-muted-foreground">Keep microphone open</div>
            </div>
            {isContinuous && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
