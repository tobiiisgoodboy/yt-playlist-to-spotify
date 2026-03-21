import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("spotify_access_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const playlists: { id: string; name: string; tracksCount: number; image: string }[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50" as string | null;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Spotify API error" }, { status: res.status });
    }
    const data = await res.json();
    for (const item of data.items ?? []) {
      playlists.push({
        id: item.id,
        name: item.name,
        tracksCount: item.tracks?.total ?? 0,
        image: item.images?.[0]?.url ?? "",
      });
    }
    url = data.next ?? null;
  }

  return NextResponse.json({ playlists });
}
