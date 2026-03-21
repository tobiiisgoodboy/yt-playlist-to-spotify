import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function spotifyFetch(url: string, token: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("spotify_access_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uris, playlistName } = await request.json();
  if (!uris?.length) {
    return NextResponse.json({ error: "No tracks provided" }, { status: 400 });
  }

  // Get current user id
  const meRes = await spotifyFetch("https://api.spotify.com/v1/me", token);
  if (!meRes.ok) {
    return NextResponse.json({ error: "Failed to get Spotify user" }, { status: 500 });
  }
  const me = await meRes.json();

  // Create new playlist
  const createRes = await spotifyFetch(
    `https://api.spotify.com/v1/users/${me.id}/playlists`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        name: playlistName ?? "YT Import",
        public: false,
        description: "Imported from YouTube via YT Playlist to Spotify",
      }),
    }
  );
  if (!createRes.ok) {
    return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 });
  }
  const playlist = await createRes.json();

  // Add tracks in batches of 100 (Spotify limit)
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    await spotifyFetch(
      `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ uris: batch }),
      }
    );
  }

  return NextResponse.json({ playlistUrl: playlist.external_urls.spotify });
}
