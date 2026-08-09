import { LandingHeader } from "@/components/landing-header";

/**
 * Kept so /privacy-policy and /terms keep their existing import. It used to
 * resolve the session to decide between "Sign in" and "Dashboard"; with no auth
 * there is nothing to resolve.
 */
export function LandingHeaderWrapper() {
  return <LandingHeader />;
}
