import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getExtensionCorsHeaders } from "@/lib/db/extension-cors";
import { withRoute } from "@/lib/log/route";

export const OPTIONS = withRoute("/api/extension/status", async (req: Request) => {
  return new NextResponse(null, {
    status: 204,
    headers: getExtensionCorsHeaders(req),
  });
});

export const GET = withRoute("/api/extension/status", async (req: Request) => {
  const corsHeaders = getExtensionCorsHeaders(req);
  try {
    const { userId } = await getUser();
    return NextResponse.json(
      {
        status: "ok",
        appName: "BetterJob",
        version: "1.5.0",
        userId,
        authenticated: true,
        timestamp: new Date().toISOString(),
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to verify status",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
