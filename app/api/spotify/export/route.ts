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

  const { uris, playlistName, playlistId } = await request.json();
  if (!uris?.length) {
    return NextResponse.json({ error: "No tracks provided" }, { status: 400 });
  }

  let targetPlaylistId: string;
  let playlistUrl: string;

  if (playlistId) {
    // Add to existing playlist
    targetPlaylistId = playlistId;
    const infoRes = await spotifyFetch(`https://api.spotify.com/v1/playlists/${playlistId}`, token);
    if (!infoRes.ok) {
      const body = await infoRes.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: `Nie można pobrać playlisty: ${body?.error?.message ?? infoRes.status}` },
        { status: 500 }
      );
    }
    const info = await infoRes.json();
    playlistUrl = info.external_urls.spotify;
  } else {
    // Create new playlist
    const meRes = await spotifyFetch("https://api.spotify.com/v1/me", token);
    if (!meRes.ok) {
      const body = await meRes.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: `Nie można pobrać profilu Spotify: ${body?.error?.message ?? meRes.status}` },
        { status: 500 }
      );
    }
    const me = await meRes.json();

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
      if (createRes.status === 403) {
        return NextResponse.json(
          { error: "Brak uprawnien do tworzenia playlist. Polacz Spotify ponownie.", reconnect: true },
          { status: 403 }
        );
      }
      const body = await createRes.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: `Nie można utworzyć playlisty: ${body?.error?.message ?? createRes.status}` },
        { status: 500 }
      );
    }
    const created = await createRes.json();
    targetPlaylistId = created.id;
    playlistUrl = created.external_urls.spotify;
  }

  // Add tracks in batches of 100 (Spotify limit)
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    await spotifyFetch(
      `https://api.spotify.com/v1/playlists/${targetPlaylistId}/tracks`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ uris: batch }),
      }
    );
  }

  return NextResponse.json({ playlistUrl });
}
