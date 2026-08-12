import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // If this is a Server Action request or non-GET request, bypass header modification
  // to avoid mutating the request stream and breaking fetchServerAction
  if (request.headers.has("next-action") || request.method !== "GET") {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files & images
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
