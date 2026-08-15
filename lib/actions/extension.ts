"use server";

import { getUser } from "@/lib/auth";
import { getOrCreateExtensionSecret } from "@/lib/db/extension-secret";

/** The per-install secret the browser extension pastes into its popup. */
export async function getExtensionSecret(): Promise<string> {
  const { userId } = await getUser();
  return getOrCreateExtensionSecret(userId);
}
