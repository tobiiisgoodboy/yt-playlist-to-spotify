import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function cleanTitle(title: string): string {
  return title
    .replace(/\(?(official\s*(music\s*)?video|official\s*audio|lyrics?|lyric\s*video|visualizer|hd|hq|4k|mv|m\/v)\)?/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/feat\.?\s+[^,]+/gi, "")
    .replace(/ft\.?\s+[^,]+/gi, "")
    .replace(/prod\.?\s+by\s+[^,]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("spotify_access_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const title = request.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "Missing title param" }, { status: 400 });
  }

  const query = cleanTitle(title);

  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "5",
  });

  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const retryAfter = res.headers.get("Retry-After");
    return NextResponse.json(
      { error: "Spotify API error", retryAfter: retryAfter ? parseInt(retryAfter) : null },
      { status: res.status }
    );
  }

  const data = await res.json();
  const tracks = (data.tracks?.items ?? []).map((t: {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
    external_urls: { spotify: string };
    uri: string;
    preview_url: string | null;
  }) => ({
    id: t.id,
    uri: t.uri,
    name: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    image: t.album.images?.[1]?.url ?? t.album.images?.[0]?.url ?? "",
    url: t.external_urls.spotify,
    previewUrl: t.preview_url ?? null,
  }));

  return NextResponse.json({ tracks, query });
}
