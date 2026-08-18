"use client";

import { useEffect, useState } from "react";

export function getGreetingInfo(hour?: number): { greeting: string; emoji: string } {
  const h = hour !== undefined ? hour : (typeof window !== "undefined" ? new Date().getHours() : 12);

  if (h >= 5 && h < 12) {
    return { greeting: "Good morning", emoji: "☀️" };
  } else if (h >= 12 && h < 17) {
    return { greeting: "Good afternoon", emoji: "🌤️" };
  } else if (h >= 17 && h < 21) {
    return { greeting: "Good evening", emoji: "🌆" };
  } else {
    return { greeting: "Good night", emoji: "🌙" };
  }
}

export function ClientGreeting({
  suffix = "",
  className = "font-heading text-2xl font-bold tracking-tight sm:text-3xl",
}: {
  suffix?: string;
  className?: string;
}) {
  const [greetingInfo, setGreetingInfo] = useState<{ greeting: string; emoji: string }>(() =>
    getGreetingInfo()
  );

  useEffect(() => {
    setGreetingInfo(getGreetingInfo(new Date().getHours()));

    const interval = setInterval(() => {
      setGreetingInfo(getGreetingInfo(new Date().getHours()));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <h1 className={className} suppressHydrationWarning>
      <span suppressHydrationWarning>
        {greetingInfo.greeting}
        {suffix}
      </span>{" "}
      <span
        className="inline-block transition-transform duration-300 hover:rotate-12 hover:scale-125 select-none"
        role="img"
        aria-label="greeting icon"
        suppressHydrationWarning
      >
        {greetingInfo.emoji}
      </span>
    </h1>
  );
}
