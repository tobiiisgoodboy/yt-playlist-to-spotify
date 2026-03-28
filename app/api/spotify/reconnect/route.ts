import { NextResponse } from "next/server";

// Clears Spotify tokens and immediately redirects to Spotify OAuth login
export async function GET() {
  const loginParams = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/spotify/callback`,
    scope: [
      "playlist-read-private",
      "playlist-read-collaborative",
      "playlist-modify-public",
      "playlist-modify-private",
    ].join(" "),
    // Force Spotify to show the consent screen so user grants the new scopes
    show_dialog: "true",
  });

  const response = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${loginParams.toString()}`
  );

  // Must match original cookie flags (httpOnly + secure) so the browser actually deletes them
  const cookieOpts = { httpOnly: true, secure: true, path: "/", maxAge: 0 } as const;
  response.cookies.set("spotify_access_token", "", cookieOpts);
  response.cookies.set("spotify_refresh_token", "", cookieOpts);

  return response;
}
