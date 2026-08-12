import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET() {
  try {
    const { userId } = await getUser();
    return NextResponse.json(
      {
        status: "ok",
        appName: "atTrack",
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
}
