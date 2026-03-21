import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete("spotify_access_token");
  response.cookies.delete("spotify_refresh_token");
  return response;
}
