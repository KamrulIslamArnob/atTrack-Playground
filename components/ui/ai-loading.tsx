"use client";

/**
 * @author: @kokonutui
 * @description: AI Loading State — adapted for atTrack workspace setup
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useEffect, useRef, useState } from "react";

const TASK_SEQUENCES = [
  {
    status: "Setting up your database",
    lines: [
      "Creating local SQLite workspace...",
      "Building secure tables...",
      "Configuring private storage...",
      "Optimizing data directory...",
      "Preparing your profile...",
      "Linking your target role...",
    ],
  },
  {
    status: "Preparing your vector database",
    lines: [
      "Initializing vector search index...",
      "Building semantic embeddings...",
      "Setting up fast retrieval...",
      "Configuring memory store...",
      "Wiring up omni-search...",
      "Optimizing query engine...",
    ],
  },
  {
    status: "Your AI is getting ready",
    lines: [
      "Connecting your AI providers...",
      "Testing model credentials...",
      "Warming up your AI engine...",
      "Configuring task routing...",
      "Something very energetic will start...",
      "Finalizing your workspace...",
    ],
  },
];

const LoadingAnimation = ({ progress }: { progress: number }) => (
  <div className="relative h-6 w-6">
    <svg
      aria-label={`Loading progress: ${Math.round(progress)}%`}
      className="h-full w-full"
      fill="none"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Loading Progress Indicator</title>

      <defs>
        <mask id="progress-mask">
          <rect fill="black" height="240" width="240" />
          <circle
            cx="120"
            cy="120"
            fill="white"
            r="120"
            strokeDasharray={`${(progress / 100) * 754}, 754`}
            transform="rotate(-90 120 120)"
          />
        </mask>
      </defs>

      <style>
        {`
                    @keyframes rotate-cw {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    @keyframes rotate-ccw {
                        from { transform: rotate(360deg); }
                        to { transform: rotate(0deg); }
                    }
                    .g-spin circle {
                        transform-origin: 120px 120px;
                    }
                    .g-spin circle:nth-child(1) { animation: rotate-cw 8s linear infinite; }
                    .g-spin circle:nth-child(2) { animation: rotate-ccw 8s linear infinite; }
                    .g-spin circle:nth-child(3) { animation: rotate-cw 8s linear infinite; }
                    .g-spin circle:nth-child(4) { animation: rotate-ccw 8s linear infinite; }
                    .g-spin circle:nth-child(5) { animation: rotate-cw 8s linear infinite; }
                    .g-spin circle:nth-child(6) { animation: rotate-ccw 8s linear infinite; }

                    .g-spin circle:nth-child(2n) { animation-delay: 0.2s; }
                    .g-spin circle:nth-child(3n) { animation-delay: 0.3s; }
                `}
      </style>

      <g
        className="g-spin"
        mask="url(#progress-mask)"
        strokeDasharray="18% 40%"
        strokeWidth="16"
      >
        <circle cx="120" cy="120" opacity="0.95" r="150" stroke="#2563eb" />
        <circle cx="120" cy="120" opacity="0.95" r="130" stroke="#0ea5e9" />
        <circle cx="120" cy="120" opacity="0.95" r="110" stroke="#38bdf8" />
        <circle cx="120" cy="120" opacity="0.95" r="90" stroke="#2563eb" />
        <circle cx="120" cy="120" opacity="0.95" r="70" stroke="#60a5fa" />
        <circle cx="120" cy="120" opacity="0.95" r="50" stroke="#1d4ed8" />
      </g>
    </svg>
  </div>
);

export default function AILoadingState() {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState<
    Array<{ text: string; number: number }>
  >([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const lineHeight = 28;

  const currentSequence = TASK_SEQUENCES[sequenceIndex];
  const totalLines = currentSequence.lines.length;

  useEffect(() => {
    const initialLines = [];
    for (let i = 0; i < Math.min(5, totalLines); i++) {
      initialLines.push({
        text: currentSequence.lines[i],
        number: i + 1,
      });
    }
    setVisibleLines(initialLines);
    setScrollPosition(0);
  }, [sequenceIndex, currentSequence.lines, totalLines]);

  // Handle line advancement
  useEffect(() => {
    const advanceTimer = setInterval(() => {
      const firstVisibleLineIndex = Math.floor(scrollPosition / lineHeight);
      const nextLineIndex = (firstVisibleLineIndex + 3) % totalLines;

      if (nextLineIndex < firstVisibleLineIndex && nextLineIndex !== 0) {
        setSequenceIndex(
          (prevIndex) => (prevIndex + 1) % TASK_SEQUENCES.length
        );
        return;
      }

      if (nextLineIndex >= visibleLines.length && nextLineIndex < totalLines) {
        setVisibleLines((prevLines) => [
          ...prevLines,
          {
            text: currentSequence.lines[nextLineIndex],
            number: nextLineIndex + 1,
          },
        ]);
      }

      setScrollPosition((prevPosition) => prevPosition + lineHeight);
    }, 1800);

    return () => clearInterval(advanceTimer);
  }, [
    scrollPosition,
    visibleLines,
    totalLines,
    sequenceIndex,
    currentSequence.lines,
    lineHeight,
  ]);

  // Apply scroll position
  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  return (
    <div className="flex min-h-full w-full items-center justify-center">
      <div className="w-full max-w-[360px] space-y-4">
        <div className="ml-2 flex items-center space-x-2.5 font-medium text-foreground">
          <LoadingAnimation
            progress={(sequenceIndex / TASK_SEQUENCES.length) * 100}
          />
          <span className="text-sm font-semibold tracking-tight">{currentSequence.status}...</span>
        </div>

        <div className="relative">
          <div
            className="relative h-[84px] w-full overflow-hidden rounded-xl border border-border/50 bg-muted/20 font-mono text-xs"
            ref={codeContainerRef}
            style={{ scrollBehavior: "smooth" }}
          >
            <div>
              {visibleLines.map((line) => (
                <div
                  className="flex h-[28px] items-center px-2"
                  key={`${line.number}-${line.text}`}
                >
                  <div className="w-6 select-none pr-3 text-right text-muted-foreground">
                    {line.number}
                  </div>

                  <div className="ml-1 flex-1 text-foreground/90">
                    {line.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 rounded-xl from-card via-card/50 to-transparent"
            style={{
              background:
                "linear-gradient(to bottom, var(--tw-gradient-from) 0%, var(--tw-gradient-via) 30%, var(--tw-gradient-to) 100%)",
            }}
          />
        </div>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground px-2">
          This stays on your computer — your resume, jobs and notes never leave your device. Almost there!
        </p>
      </div>
    </div>
  );
}

export { TASK_SEQUENCES };
