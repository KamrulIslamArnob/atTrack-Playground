"use client";

import React, { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import {
  GithubIcon,
  LinkedinIcon,
  TwitterIcon,
  FacebookIcon,
  InstagramIcon,
} from "./social-icons";
import { fetchAndSaveLinkFavicon } from "@/lib/actions/links";
import { cn } from "@/lib/utils";

interface WebsiteFaviconProps {
  url: string;
  title?: string;
  iconUrl?: string | null;
  linkId?: string;
  className?: string;
  iconClassName?: string;
}

export function extractDomain(urlStr: string): string {
  if (!urlStr || !urlStr.trim()) return "";
  try {
    const normalized = /^https?:\/\//i.test(urlStr.trim())
      ? urlStr.trim()
      : `https://${urlStr.trim()}`;
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Returns a custom SVG for known brand domains if favicon fails or is preferred.
 */
function getBrandFallback(domain: string, className?: string) {
  if (domain.includes("github.com")) return <GithubIcon className={className} />;
  if (domain.includes("linkedin.com")) return <LinkedinIcon className={className} />;
  if (domain.includes("twitter.com") || domain === "x.com")
    return <TwitterIcon className={className} />;
  if (domain.includes("facebook.com")) return <FacebookIcon className={className} />;
  if (domain.includes("instagram.com")) return <InstagramIcon className={className} />;
  return null;
}

// Client-side in-memory & localStorage fast cache
const LOCAL_STORAGE_KEY = "attrack_domain_favicons";
function getCachedDomainIcon(domain: string): string | null {
  if (typeof window === "undefined" || !domain) return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    return cache[domain] ?? null;
  } catch {
    return null;
  }
}

function setCachedDomainIcon(domain: string, dataUrl: string) {
  if (typeof window === "undefined" || !domain || !dataUrl) return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[domain] = dataUrl;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

export function WebsiteFavicon({
  url,
  title,
  iconUrl,
  linkId,
  className,
  iconClassName = "size-4 text-muted-foreground",
}: WebsiteFaviconProps) {
  const domain = extractDomain(url);
  const brandIcon = domain ? getBrandFallback(domain, iconClassName) : null;

  const isNone = iconUrl === "none";
  const validIcon = iconUrl && !isNone ? iconUrl : null;

  // Determine initial image source (db icon_url -> localStorage domain cache -> CDN sources)
  const [cachedSource, setCachedSource] = useState<string | null>(validIcon);
  const [loaded, setLoaded] = useState<boolean>(Boolean(validIcon));
  const [hasError, setHasError] = useState<boolean>(isNone);
  const [imgSrcIndex, setImgSrcIndex] = useState<number>(0);

  useEffect(() => {
    if (iconUrl === "none") {
      setCachedSource(null);
      setLoaded(false);
      setHasError(true);
      return;
    }
    if (iconUrl && iconUrl.startsWith("data:")) {
      setCachedSource(iconUrl);
      setLoaded(true);
      setHasError(false);
      return;
    }
    if (domain) {
      const localCached = getCachedDomainIcon(domain);
      if (localCached === "none") {
        setCachedSource(null);
        setHasError(true);
        return;
      }
      if (localCached) {
        setCachedSource(localCached);
        setLoaded(true);
        return;
      }
      if (linkId && iconUrl === null) {
        fetchAndSaveLinkFavicon(linkId, url)
          .then((saved) => {
            if (saved && saved !== "none") {
              setCachedSource(saved);
              setLoaded(true);
              setCachedDomainIcon(domain, saved);
            } else {
              setHasError(true);
              setCachedDomainIcon(domain, "none");
            }
          })
          .catch(() => {
            setHasError(true);
          });
      }
    }
  }, [iconUrl, domain, linkId, url]);

  const sources = domain && !isNone && getCachedDomainIcon(domain) !== "none"
    ? [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
      ]
    : [];

  const handleImageError = () => {
    if (cachedSource) {
      setCachedSource(null);
      setLoaded(false);
      setImgSrcIndex(0);
    } else if (imgSrcIndex + 1 < sources.length) {
      setImgSrcIndex((prev) => prev + 1);
    } else {
      setHasError(true);
      if (domain) setCachedDomainIcon(domain, "none");
    }
  };

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    if (!cachedSource && domain && typeof window !== "undefined") {
      try {
        const img = e.currentTarget;
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, 32, 32);
          const dataUrl = canvas.toDataURL("image/png");
          if (dataUrl && dataUrl.length > 50) {
            setCachedDomainIcon(domain, dataUrl);
          }
        }
      } catch {}
    }
  };

  const currentSource = cachedSource || (sources.length > 0 ? sources[imgSrcIndex] : null);

  return (
    <div
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 overflow-hidden text-muted-foreground shadow-2xs transition-transform duration-150 group-hover:scale-105",
        className
      )}
    >
      {currentSource && !hasError ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              {brandIcon ?? <Globe className={iconClassName} />}
            </div>
          )}
          <img
            src={currentSource}
            alt={title ? `${title} logo` : domain ? `${domain} logo` : "Website logo"}
            className={cn(
              "size-4.5 object-contain transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0"
            )}
            loading="lazy"
            crossOrigin="anonymous"
            onLoad={handleImageLoaded}
            onError={handleImageError}
          />
        </>
      ) : (
        brandIcon ?? <Globe className={iconClassName} />
      )}
    </div>
  );
}
