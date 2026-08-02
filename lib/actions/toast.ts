"use server";

import { cookies } from "next/headers";

export async function setToast(type: "success" | "error", message: string) {
  const cookieStore = await cookies();
  cookieStore.set("toast", JSON.stringify({ type, message }), {
    path: "/",
    maxAge: 5,
  });
}
