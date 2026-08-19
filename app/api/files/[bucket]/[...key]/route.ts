import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isPublicBucket, readObject, verifyObjectToken } from "@/lib/db/storage";
import { withRoute } from "@/lib/log/route";

// Serves objects that used to come from Supabase Storage URLs.
//
// Two ways in, mirroring the buckets' old policies:
//   * signed — ?exp=&token= from createSignedUrl(); HMAC-verified, time-limited.
//   * owner  — the key sits under the local owner's "{userId}/" prefix.
//
// The owner check is no longer an authentication boundary — this is a native
// single-user app with no login, so anyone who can reach the process is the
// owner. It remains as a path guard: it stops a request from reading objects
// filed under some other id (e.g. rows left over from the earlier multi-user
// build). Public buckets (avatar) skip both checks.

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function contentTypeFor(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return CONTENT_TYPES[key.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

// `request` is typed as the platform `Request` rather than `NextRequest` so it
// fits withRoute's signature; the only NextRequest member used here was
// `nextUrl.searchParams`, which `new URL(request.url)` gives identically.
export const GET = withRoute("/api/files/[bucket]/[...key]", async (
  request: Request,
  context: { params: Promise<{ bucket: string; key: string[] | string }> }
) => {
  const { bucket, key: rawSegments } = await context.params;
  const segments = Array.isArray(rawSegments)
    ? rawSegments
    : typeof rawSegments === "string"
    ? [rawSegments]
    : [];

  const rawKey = segments.map(decodeURIComponent).join("/");
  const key = rawKey.replace(/^\/+/, "");

  // Reject traversal before the value reaches the filesystem layer.
  if (!key || key.includes("..")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  let authorized = isPublicBucket(bucket);

  if (!authorized) {
    const searchParams = new URL(request.url).searchParams;
    const exp = Number(searchParams.get("exp"));
    const token = searchParams.get("token");

    if (token && exp) {
      authorized = verifyObjectToken(bucket, key, exp, token);
    }

    if (!authorized) {
      // Fall back to session ownership: the first path segment is the owner's id.
      try {
        const { userId } = await getUser();
        authorized = key.startsWith(`${userId}/`);
      } catch {
        authorized = false;
      }
    }
  }

  if (!authorized) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buf = await readObject(bucket, key);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentTypeFor(key),
        "Content-Length": String(buf.byteLength),
        "Cache-Control": isPublicBucket(bucket)
          ? "public, max-age=0, must-revalidate"
          : "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
});
