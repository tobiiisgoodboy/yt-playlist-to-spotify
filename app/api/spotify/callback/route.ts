import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify_error=1", request.url));
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/spotify/callback`,
  });

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?spotify_error=1", request.url));
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokenData;
  const scope: string = tokenData.scope ?? "";

  // Temporary diagnostic: pass scope in redirect URL so it's visible in browser
  const redirectUrl = new URL("/convert", request.url);
  redirectUrl.searchParams.set("debug_scope", scope || "EMPTY");
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("spotify_granted_scopes", scope, {
    secure: true,
    sameSite: "lax",
    maxAge: expires_in,
    path: "/",
  });

  response.cookies.set("spotify_access_token", access_token, {
    httpOnly: true,
    secure: true,
    maxAge: expires_in,
    path: "/",
  });

  if (refresh_token) {
    response.cookies.set("spotify_refresh_token", refresh_token, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return response;
}
