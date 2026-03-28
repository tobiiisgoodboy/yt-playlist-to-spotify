import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const cookieOpts = { httpOnly: true, secure: true, path: "/", maxAge: 0 } as const;
  response.cookies.set("spotify_access_token", "", cookieOpts);
  response.cookies.set("spotify_refresh_token", "", cookieOpts);
  return response;
}
