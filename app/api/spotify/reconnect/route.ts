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

  response.cookies.delete("spotify_access_token");
  response.cookies.delete("spotify_refresh_token");

  return response;
}
