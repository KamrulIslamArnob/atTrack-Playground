"use client";

import React, { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { fetchAndSaveCompanyLogo } from "@/lib/actions/companies";
import {
  GithubIcon,
  LinkedinIcon,
  TwitterIcon,
  FacebookIcon,
  InstagramIcon,
} from "./links/social-icons";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  name?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  companyId?: string;
  color?: string | null;
  className?: string;
  iconClassName?: string;
  fallback?: "glyph" | "initial";
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

function getBrandFallback(domain: string, className?: string) {
  if (domain.includes("github.com")) return <GithubIcon className={className} />;
  if (domain.includes("linkedin.com")) return <LinkedinIcon className={className} />;
  if (domain.includes("twitter.com") || domain === "x.com")
    return <TwitterIcon className={className} />;
  if (domain.includes("facebook.com")) return <FacebookIcon className={className} />;
  if (domain.includes("instagram.com")) return <InstagramIcon className={className} />;
  return null;
}

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

export function CompanyLogo({
  name,
  website,
  logoUrl,
  companyId,
  color,
  className,
  iconClassName = "size-3.5",
  fallback = "glyph",
}: CompanyLogoProps) {
  const domain = website
    ? extractDomain(website)
    : name
    ? extractDomain(name.includes(".") ? name : `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`)
    : "";

  const brandIcon = domain ? getBrandFallback(domain, iconClassName) : null;

  const isNone = logoUrl === "none";
  const validLogo = logoUrl && !isNone ? logoUrl : null;

  const [cachedSource, setCachedSource] = useState<string | null>(validLogo);
  const [loaded, setLoaded] = useState<boolean>(Boolean(validLogo));
  const [hasError, setHasError] = useState<boolean>(isNone);
  const [imgSrcIndex, setImgSrcIndex] = useState<number>(0);

  useEffect(() => {
    if (logoUrl === "none") {
      setCachedSource(null);
      setLoaded(false);
      setHasError(true);
      return;
    }
    if (logoUrl && logoUrl.startsWith("data:")) {
      setCachedSource(logoUrl);
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
      // If logo_url is null (unattempted) and companyId exists, trigger once in background
      if (companyId && logoUrl === null) {
        fetchAndSaveCompanyLogo(companyId, website || domain)
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
  }, [logoUrl, domain, companyId, website]);

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

  const renderFallback = () => {
    if (brandIcon) return brandIcon;
    if (fallback === "initial" && name && name.trim()) {
      return (
        <span className="font-semibold text-xs leading-none text-current">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      );
    }
    return (
      <Building2
        className={cn("size-3.5 shrink-0 text-muted-foreground", iconClassName)}
        style={color ? { color } : undefined}
      />
    );
  };

  return (
    <span
      className={cn(
        "relative inline-flex size-3.5 shrink-0 items-center justify-center overflow-hidden bg-transparent border-0 select-none",
        className
      )}
    >
      {currentSource && !hasError ? (
        <>
          {!loaded && (
            <span className="absolute inset-0 flex items-center justify-center">
              {renderFallback()}
            </span>
          )}
          <img
            src={currentSource}
            alt={name ? `${name} logo` : "Company logo"}
            className={cn(
              "size-full object-contain transition-opacity duration-150",
              loaded ? "opacity-100" : "opacity-0"
            )}
            loading="lazy"
            crossOrigin="anonymous"
            onLoad={handleImageLoaded}
            onError={handleImageError}
          />
        </>
      ) : (
        renderFallback()
      )}
    </span>
  );
}
